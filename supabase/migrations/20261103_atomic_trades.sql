-- Apply as the database owner, before deploying the updated client.
begin;

alter table public.trades add column if not exists initiator_box_id text;
alter table public.trades add column if not exists target_box_id text;

-- Do not silently combine this implementation with an unknown legacy swap trigger.
do $$
begin
  if exists (select 1 from pg_trigger where tgrelid = 'public.trades'::regclass and not tgisinternal and tgenabled <> 'D') then
    raise exception 'Review existing trades triggers before applying this migration';
  end if;
end;
$$;

create or replace function public.create_trade_v2(p_trade jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t public.trades%rowtype;
  a public.poke_boxes%rowtype;
  b public.poke_boxes%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  t := jsonb_populate_record(null::public.trades, p_trade);
  if t.target_user_id is null or t.target_user_id = auth.uid() then raise exception 'Invalid recipient'; end if;
  select * into a from public.poke_boxes where id::text = t.initiator_box_id::text;
  if not found or a.user_id is distinct from auth.uid() then raise exception 'Invalid initiator box'; end if;
  select * into b from public.poke_boxes where id::text = t.target_box_id::text;
  if not found or b.user_id is distinct from t.target_user_id then raise exception 'Invalid receiver box'; end if;
  select p || jsonb_build_object('__cloudBoxId', a.id, '__boxName', a.name) into t.initiator_pokemon_data
    from jsonb_array_elements(a.data::jsonb->'entries') p where p->>'id' = t.initiator_pokemon_id::text;
  select p || jsonb_build_object('__cloudBoxId', b.id, '__boxName', b.name) into t.target_pokemon_data
    from jsonb_array_elements(b.data::jsonb->'entries') p where p->>'id' = t.target_pokemon_id::text;
  if t.initiator_pokemon_data is null or t.target_pokemon_data is null then raise exception 'Pokemon no longer available'; end if;
  insert into public.trades(initiator_id, initiator_email, target_user_id, initiator_box_id, target_box_id,
    initiator_pokemon_id, target_pokemon_id, initiator_pokemon_data, target_pokemon_data,
    status, receiver_status, initiator_status, created_at)
  values(auth.uid(), auth.jwt()->>'email', t.target_user_id, t.initiator_box_id, t.target_box_id,
    t.initiator_pokemon_id, t.target_pokemon_id, t.initiator_pokemon_data, t.target_pokemon_data,
    'pending', 'pending', 'pending', clock_timestamp()) returning * into t;
  return to_jsonb(t);
end;
$$;

create or replace function public.save_box_v2(
  p_box_id text, p_data jsonb, p_name text, p_expected_revision bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  b public.poke_boxes%rowtype;
  next_data jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_expected_revision is null or p_expected_revision < 0
     or jsonb_typeof(p_data->'entries') is distinct from 'array' then
    raise exception 'Invalid box payload';
  end if;
  if p_box_id is not null then
    select * into b from public.poke_boxes where id::text = p_box_id for update;
    if not found or b.user_id <> auth.uid() then raise exception 'Box not found'; end if;
    if coalesce((b.data->>'revision')::bigint, 0) <> p_expected_revision then
      raise exception 'BOX_REVISION_CONFLICT: exporta los cambios locales y recarga la caja';
    end if;
  elsif p_expected_revision <> 0 then
    raise exception 'New box must have revision zero';
  end if;
  next_data := p_data || jsonb_build_object('revision', p_expected_revision + 1, 'updatedAt', clock_timestamp());
  if p_box_id is null then
    insert into public.poke_boxes(user_id, user_email, name, data, updated_at)
      values(auth.uid(), auth.jwt()->>'email', p_name, next_data, clock_timestamp()) returning * into b;
  else
    update public.poke_boxes set data = next_data, name = p_name,
      updated_at = clock_timestamp() where id = b.id returning * into b;
  end if;
  return to_jsonb(b);
end;
$$;

create or replace function public.accept_box_trade_v2(p_trade_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t public.trades%rowtype;
  a public.poke_boxes%rowtype;
  b public.poke_boxes%rowtype;
  aid text;
  bid text;
  ap jsonb;
  bp jsonb;
  ae jsonb;
  be jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into t from public.trades where id::text = p_trade_id for update;
  if not found or t.target_user_id <> auth.uid() then raise exception 'Trade not found'; end if;
  -- Retrying after a lost HTTP response is safe.
  if t.status = 'completed' then return to_jsonb(t); end if;
  if t.status is distinct from 'pending' then raise exception 'Trade is not pending'; end if;
  if t.initiator_id = t.target_user_id then raise exception 'Cannot trade with yourself'; end if;
  aid := coalesce(t.initiator_box_id::text, t.initiator_pokemon_data->>'__cloudBoxId');
  bid := coalesce(t.target_box_id::text, t.target_pokemon_data->>'__cloudBoxId');
  if aid is null or bid is null or aid = bid then raise exception 'Invalid trade boxes; create a new request'; end if;
  -- Deterministic locking order also protects against two overlapping trades.
  perform id from public.poke_boxes where id::text in (aid, bid) order by id for update;
  select * into a from public.poke_boxes where id::text = aid;
  if not found or a.user_id is distinct from t.initiator_id then raise exception 'Invalid initiator box'; end if;
  select * into b from public.poke_boxes where id::text = bid;
  if not found or b.user_id is distinct from t.target_user_id then raise exception 'Invalid receiver box'; end if;
  if jsonb_typeof(a.data->'entries') is distinct from 'array'
     or jsonb_typeof(b.data->'entries') is distinct from 'array' then raise exception 'Invalid box entries'; end if;
  if (select count(*) from jsonb_array_elements(a.data->'entries') p where p->>'id' = t.initiator_pokemon_id::text) <> 1
     or (select count(*) from jsonb_array_elements(b.data->'entries') p where p->>'id' = t.target_pokemon_id::text) <> 1 then
    raise exception 'A traded Pokemon is missing or duplicated';
  end if;
  if exists(select 1 from jsonb_array_elements(a.data->'entries') p where p->>'id' = t.target_pokemon_id::text)
     or exists(select 1 from jsonb_array_elements(b.data->'entries') p where p->>'id' = t.initiator_pokemon_id::text) then
    raise exception 'Incoming Pokemon already exists in destination';
  end if;
  select p - '__boxId' - '__cloudBoxId' - '__boxName' into ap
    from jsonb_array_elements(a.data->'entries') p where p->>'id' = t.initiator_pokemon_id::text;
  select p - '__boxId' - '__cloudBoxId' - '__boxName' into bp
    from jsonb_array_elements(b.data->'entries') p where p->>'id' = t.target_pokemon_id::text;
  select jsonb_agg(case when p->>'id' = t.initiator_pokemon_id::text then bp else p end order by ord)
    into ae from jsonb_array_elements(a.data->'entries') with ordinality as e(p, ord);
  select jsonb_agg(case when p->>'id' = t.target_pokemon_id::text then ap else p end order by ord)
    into be from jsonb_array_elements(b.data->'entries') with ordinality as e(p, ord);
  update public.poke_boxes set data = a.data::jsonb || jsonb_build_object(
    'entries', ae, 'revision', coalesce((a.data->>'revision')::bigint, 0) + 1,
    'deviceId', 'server-trade', 'updatedAt', clock_timestamp()), updated_at = clock_timestamp() where id = a.id;
  update public.poke_boxes set data = b.data::jsonb || jsonb_build_object(
    'entries', be, 'revision', coalesce((b.data->>'revision')::bigint, 0) + 1,
    'deviceId', 'server-trade', 'updatedAt', clock_timestamp()), updated_at = clock_timestamp() where id = b.id;
  update public.trades set status = 'completed', receiver_status = 'accepted', initiator_status = 'accepted',
    updated_at = clock_timestamp() where id = t.id returning * into t;
  return to_jsonb(t);
end;
$$;

create or replace function public.reject_trade_v2(p_trade_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.trades%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into t from public.trades where id::text = p_trade_id for update;
  if not found or (t.initiator_id <> auth.uid() and t.target_user_id <> auth.uid()) then
    raise exception 'Trade not found';
  end if;
  if t.status = 'rejected' then return to_jsonb(t); end if;
  if t.status is distinct from 'pending' then raise exception 'Trade is not pending'; end if;
  update public.trades set status = 'rejected', updated_at = clock_timestamp() where id = t.id returning * into t;
  return to_jsonb(t);
end;
$$;

-- Old browser tabs must not bypass the revision check or execute legacy swaps.
revoke update on public.poke_boxes from public, anon, authenticated;
revoke update (data) on public.poke_boxes from public, anon, authenticated;
grant update (name, updated_at) on public.poke_boxes to authenticated;
revoke insert, update on public.trades from public, anon, authenticated;
do $$
declare f record; c record;
begin
  for c in select column_name from information_schema.columns where table_schema = 'public' and table_name = 'trades' loop
    execute format('revoke insert (%I), update (%I) on public.trades from public, anon, authenticated', c.column_name, c.column_name);
  end loop;
  for f in select oid::regprocedure as signature from pg_proc
    where pronamespace = 'public'::regnamespace and proname in
      ('accept_box_trade', 'accept_and_complete_trade', 'complete_trade_swap') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.signature);
  end loop;
end;
$$;
revoke all on function public.save_box_v2(text,jsonb,text,bigint) from public, anon;
revoke all on function public.accept_box_trade_v2(text) from public, anon;
revoke all on function public.reject_trade_v2(text) from public, anon;
revoke all on function public.create_trade_v2(jsonb) from public, anon;
grant execute on function public.save_box_v2(text,jsonb,text,bigint) to authenticated;
grant execute on function public.accept_box_trade_v2(text) to authenticated;
grant execute on function public.reject_trade_v2(text) to authenticated;
grant execute on function public.create_trade_v2(jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
