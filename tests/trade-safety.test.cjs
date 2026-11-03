const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const tick = () => new Promise(resolve => setImmediate(resolve));

function tradeContext(overrides = {}) {
  const calls = [];
  const trade = { id: 't', status: 'pending', target_user_id: 'receiver', target_box_id: 'b' };
  const api = {
    getTradeById: async () => trade,
    getUser: async () => ({ id: 'receiver' }),
    acceptBoxTrade: async () => calls.push('accept'),
    getBoxById: async () => ({ id: 'b', data: { entries: [{ id: 'incoming' }], revision: 2 } }),
    updateBoxById: async () => { throw new Error('UNSAFE WRITE'); },
    ...overrides
  };
  const ctx = vm.createContext({ window: { Supa: api }, calls, currentCloudBoxId: 'b',
    dirty: false, __autosaveInFlight: false, __cloudSavePromise: null,
    saveToSupabase: async () => {}, rememberCloudRow: () => {},
    applyAppState: data => calls.push(data.entries[0].id), toast: message => calls.push(message) });
  vm.runInContext(source('js/trades.js'), ctx);
  vm.runInContext('loadPendingTrades = async () => {}; updatePendingTradesBadge = async () => {};', ctx);
  return { ctx, calls, trade };
}

test('RPC failure never performs separate box writes or reports success', async () => {
  const { ctx, calls } = tradeContext({ acceptBoxTrade: async () => { throw new Error('network'); } });
  await ctx.acceptPendingTrade('t');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /No se pudo confirmar/);
});

test('double click issues only one acceptance; success reloads without Realtime', async () => {
  const pending = deferred(); let count = 0;
  const { ctx, calls } = tradeContext({ acceptBoxTrade: () => { count++; return pending.promise; } });
  const first = ctx.acceptPendingTrade('t');
  const second = ctx.acceptPendingTrade('t');
  await tick(); assert.equal(count, 1);
  pending.resolve(); await Promise.all([first, second]);
  assert.ok(calls.includes('incoming'));
  assert.ok(calls.includes('Intercambio completado'));
});

test('refresh does not discard edits made during acceptance', async () => {
  const pending = deferred();
  const { ctx, calls } = tradeContext({ acceptBoxTrade: () => pending.promise });
  const request = ctx.acceptPendingTrade('t');
  await tick(); ctx.dirty = true; pending.resolve(); await request;
  assert.ok(!calls.includes('incoming'));
});

test('non-recipient cannot accept', async () => {
  const { ctx, calls } = tradeContext({ getUser: async () => ({ id: 'stranger' }) });
  await ctx.acceptPendingTrade('t');
  assert.ok(!calls.includes('accept'));
});

function cloudContext(saveBox) {
  const ctx = vm.createContext({ window: { Supa: { saveBox }, addEventListener() {} },
    document: { addEventListener() {} }, console: { warn() {} },
    clearTimeout() {}, setTimeout() {},
    __isLoggedIn: true, __autosaveInFlight: false, __syncDebounceTimer: null,
    __lastLocalChangeAt: 'edit-1', __lastCloudRevision: 4,
    currentBoxId: 'local-b', currentCloudBoxId: 'b', currentBoxName: 'Box', dirty: true,
    setDirty(value) { ctx.dirty = value; }, updateCloudStatus() {}, toast() {} });
  vm.runInContext(source('js/auth-cloud.js'), ctx);
  vm.runInContext(`serializeAppState = async () => ({ entries: [], revision: 5 });
    rememberCloudRow = row => { __lastCloudRevision = row.data.revision; };
    queueCloudSync = () => {};`, ctx);
  return ctx;
}

test('waiting for an in-flight save actually waits', async () => {
  const pending = deferred(); let count = 0; let secondDone = false;
  const ctx = cloudContext(() => { count++; return pending.promise; });
  const first = ctx.saveToSupabase();
  const second = ctx.saveToSupabase().then(() => { secondDone = true; });
  await tick(); assert.equal(secondDone, false); assert.equal(count, 1);
  pending.resolve({ data: { revision: 5 } }); await Promise.all([first, second]);
  assert.equal(secondDone, true); assert.equal(ctx.dirty, false);
});

test('edits during a save cause a subsequent save using the returned revision', async () => {
  const pending = deferred(); const revisions = [];
  const ctx = cloudContext((payload, name, id, revision) => {
    revisions.push(revision);
    return revisions.length === 1 ? pending.promise : Promise.resolve({ data: { revision: 6 } });
  });
  const first = ctx.saveToSupabase(); await tick();
  ctx.__lastLocalChangeAt = 'edit-2';
  const second = ctx.saveToSupabase();
  pending.resolve({ data: { revision: 5 } }); await Promise.all([first, second]);
  assert.deepEqual(revisions, [4, 5]);
});

test('revision conflict preserves edits and blocks repeated stale saves', async () => {
  let count = 0;
  const ctx = cloudContext(async () => { count++; throw new Error('BOX_REVISION_CONFLICT'); });
  await assert.rejects(ctx.saveToSupabase(), /BOX_REVISION_CONFLICT/);
  await assert.rejects(ctx.saveToSupabase(), /Exporta/);
  assert.equal(count, 1); assert.equal(ctx.dirty, true); assert.equal(ctx.__lastCloudRevision, 4);
});

test('cloud API uses v2 RPC and does not fall back on a failed save', async () => {
  const calls = [];
  const sb = { rpc: async (name, args) => { calls.push([name, args]); return { error: new Error('conflict') }; } };
  const ctx = vm.createContext({ window: { supabase: { createClient: () => sb } } });
  vm.runInContext(source('supabase.js'), ctx);
  await assert.rejects(ctx.window.Supa.saveBox({ entries: [] }, 'Box', 'b', 7), /conflict/);
  assert.equal(calls.length, 1); assert.equal(calls[0][0], 'save_box_v2');
  assert.equal(calls[0][1].p_expected_revision, 7);
});

test('login retains the revision of offline edits instead of adopting the server revision', async () => {
  let expected;
  const ctx = cloudContext(async (_payload, _name, _id, revision) => {
    expected = revision; throw new Error('BOX_REVISION_CONFLICT');
  });
  const row = { id: 'b', name: 'Box', data: { entries: [], revision: 9 } };
  Object.assign(ctx, { __boxCatalog: [], __cloudUserId: 'receiver', mergeCloudBoxes() {},
    createCloudBoxId: id => 'cloud-' + id });
  ctx.window.Supa.getUser = async () => ({ id: 'receiver' });
  ctx.window.Supa.listBoxes = async () => [row];
  vm.runInContext('maybeCreateDailyBackup = async () => {};', ctx);
  await assert.rejects(ctx.syncOnLogin(), /BOX_REVISION_CONFLICT/);
  assert.equal(expected, 4);
  assert.equal(ctx.__lastCloudRevision, 4);
});

test('rename does not adopt a newer revision without loading its entries', async () => {
  const ctx = cloudContext(async () => {});
  Object.assign(ctx, { prompt: () => 'Renamed', BOX_NAME_MAX_LENGTH: 30,
    normalizeBoxName: value => value, isBoxNameOverLimit: () => false,
    updateActiveBoxRecord() {}, backup() {}, updateBoxSwitchUI() {}, updateStatus() {} });
  ctx.window.Supa.getUser = async () => ({ id: 'receiver' });
  ctx.window.Supa.renameBox = async () => ({ id: 'b', data: { revision: 9 } });
  await ctx.renameActiveBoxFromPrompt();
  assert.equal(ctx.currentBoxName, 'Renamed');
  assert.equal(ctx.__lastCloudRevision, 4);
});
