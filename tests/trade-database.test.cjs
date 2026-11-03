// PGLITE_PATH points to an extracted @electric-sql/pglite package (tested: 0.5.15).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(path.join(process.env.PGLITE_PATH, 'dist/index.cjs'));

test('atomic trades and revision protection in PostgreSQL', async t => {
  const db = new PGlite();
  const alice = '00000000-0000-0000-0000-000000000001';
  const bob = '00000000-0000-0000-0000-000000000002';
  const outsider = '00000000-0000-0000-0000-000000000003';
  const asUser = id => db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  const rpc = async (name, args) => (await db.query(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as result`, args)).rows[0].result;
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select '{"email":"test@example.com"}'::jsonb $$;
      create table public.poke_boxes(id uuid primary key default gen_random_uuid(), user_id uuid not null,
        user_email text, name text, data jsonb, updated_at timestamptz default now());
      create table public.trades(id uuid primary key default gen_random_uuid(), initiator_id uuid not null,
        initiator_email text, target_user_id uuid not null, initiator_pokemon_id text, target_pokemon_id text,
        initiator_pokemon_data jsonb, target_pokemon_data jsonb, status text, receiver_status text,
        initiator_status text, created_at timestamptz, updated_at timestamptz);
      grant all on public.poke_boxes, public.trades to authenticated;
    `);
    await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261103_atomic_trades.sql'), 'utf8'));
    await asUser(alice);
    const a = await rpc('save_box_v2', [null, { entries: [{ id: 'a', name: 'Alice Pokemon', hp: 17 }], bag: { coins: 2 } }, 'Alice', 0]);
    await asUser(bob);
    const b = await rpc('save_box_v2', [null, { entries: [{ id: 'b', name: 'Bob Pokemon', hp: 23 }], bag: { coins: 3 } }, 'Bob', 0]);
    const request = { target_user_id: bob, initiator_box_id: a.id, target_box_id: b.id,
      initiator_pokemon_id: 'a', target_pokemon_id: 'b' };
    await asUser(alice);
    const trade = await rpc('create_trade_v2', [request]);
    const overlapping = await rpc('create_trade_v2', [request]);
    const boxes = async () => (await db.query('select id, data from public.poke_boxes order by id')).rows;
    const before = await boxes();

    await t.test('wrong user cannot accept or cancel another pair’s trade', async () => {
      await asUser(outsider);
      await assert.rejects(rpc('accept_box_trade_v2', [trade.id]), /Trade not found/);
      await assert.rejects(rpc('reject_trade_v2', [trade.id]), /Trade not found/);
      assert.deepEqual(await boxes(), before);
    });
    await t.test('failure writing second box rolls back first box and status', async () => {
      await db.exec(`create function public.fail_second_box() returns trigger language plpgsql as $$
        begin if new.id = '${b.id}' then raise exception 'simulated second write failure'; end if; return new; end $$;
        create trigger test_failure before update on public.poke_boxes for each row execute function public.fail_second_box();`);
      await asUser(bob);
      await assert.rejects(rpc('accept_box_trade_v2', [trade.id]), /simulated second write failure/);
      assert.deepEqual(await boxes(), before);
      assert.equal((await db.query('select status from public.trades where id = $1', [trade.id])).rows[0].status, 'pending');
      await db.exec('drop trigger test_failure on public.poke_boxes');
    });
    await t.test('successful swap preserves Pokemon fields and unrelated box data', async () => {
      const result = await rpc('accept_box_trade_v2', [trade.id]);
      assert.equal(result.status, 'completed');
      const rows = await boxes();
      const nextA = rows.find(r => r.id === a.id).data;
      const nextB = rows.find(r => r.id === b.id).data;
      assert.deepEqual(nextA.entries, b.data.entries);
      assert.deepEqual(nextB.entries, a.data.entries);
      assert.deepEqual(nextA.bag, a.data.bag); assert.deepEqual(nextB.bag, b.data.bag);
      assert.equal(nextA.revision, 2); assert.equal(nextB.revision, 2);
    });
    await t.test('retry after lost response does not swap twice', async () => {
      const after = await boxes();
      await rpc('accept_box_trade_v2', [trade.id]);
      assert.deepEqual(await boxes(), after);
      await assert.rejects(rpc('reject_trade_v2', [trade.id]), /not pending/);
    });
    await t.test('overlapping trade cannot spend the same Pokemon again', async () => {
      const after = await boxes();
      await assert.rejects(rpc('accept_box_trade_v2', [overlapping.id]), /missing or duplicated/);
      assert.deepEqual(await boxes(), after);
    });
    await t.test('stale autosave cannot undo the exchange', async () => {
      const after = await boxes();
      await assert.rejects(rpc('save_box_v2', [b.id, b.data, 'Bob', 1]), /BOX_REVISION_CONFLICT/);
      assert.deepEqual(await boxes(), after);
    });
    await t.test('authenticated clients cannot bypass RPC with direct writes', async () => {
      await db.exec('set role authenticated');
      await assert.rejects(db.query('update public.poke_boxes set data = $1 where id = $2', [b.data, b.id]), /permission denied/);
      await assert.rejects(db.query("update public.trades set status = 'completed' where id = $1", [overlapping.id]), /permission denied/);
      await db.exec('reset role');
    });
    await t.test('cancelled request cannot be accepted', async () => {
      await rpc('reject_trade_v2', [overlapping.id]);
      await assert.rejects(rpc('accept_box_trade_v2', [overlapping.id]), /not pending/);
    });
  } finally { await db.close(); }
});
