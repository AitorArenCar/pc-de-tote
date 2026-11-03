-- Apply after 20261103_atomic_trades.sql, before deploying the v3 client.
begin;

create or replace function public.trade_form_group(entries jsonb, pokemon_id text)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  selected jsonb;
  forms jsonb;
begin
  if jsonb_typeof(entries) is distinct from 'array' then raise exception 'Invalid box entries'; end if;
  if (select count(*) from jsonb_array_elements(entries) p where p->>'id' = pokemon_id) <> 1 then
    raise exception 'A traded Pokemon is missing or duplicated';
  end if;
  select p into selected from jsonb_array_elements(entries) p where p->>'id' = pokemon_id;
  select jsonb_agg(p order by ord) into forms
    from jsonb_array_elements(entries) with ordinality as e(p, ord)
    where p->>'id' = pokemon_id
       or (nullif(selected->>'linkGroupId', '') is not null and p->>'linkGroupId' = selected->>'linkGroupId');
  if exists(select 1 from jsonb_array_elements(forms) f
    where nullif(f->>'id', '') is null or
      (select count(*) from jsonb_array_elements(entries) p where p->>'id' = f->>'id') <> 1) then
    raise exception 'A linked Pokemon is missing an ID or duplicated';
  end if;
  return forms;
end;
$$;

create or replace function public.create_trade_v3(p_trade jsonb)
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
  t.initiator_pokemon_data := t.initiator_pokemon_data || jsonb_build_object('__linkedForms',
    public.trade_form_group(a.data->'entries', t.initiator_pokemon_id::text));
  t.target_pokemon_data := t.target_pokemon_data || jsonb_build_object('__linkedForms',
    public.trade_form_group(b.data->'entries', t.target_pokemon_id::text));
  insert into public.trades(initiator_id, initiator_email, target_user_id, initiator_box_id, target_box_id,
    initiator_pokemon_id, target_pokemon_id, initiator_pokemon_data, target_pokemon_data,
    status, receiver_status, initiator_status, created_at)
  values(auth.uid(), auth.jwt()->>'email', t.target_user_id, t.initiator_box_id, t.target_box_id,
    t.initiator_pokemon_id, t.target_pokemon_id, t.initiator_pokemon_data, t.target_pokemon_data,
    'pending', 'pending', 'pending', clock_timestamp()) returning * into t;
  return to_jsonb(t);
end;
$$;

create or replace function public.accept_box_trade_v3(p_trade_id text)
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
  ag jsonb;
  bg jsonb;
  new_ag text := gen_random_uuid()::text;
  new_bg text := gen_random_uuid()::text;
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
  ag := public.trade_form_group(a.data->'entries', t.initiator_pokemon_id::text);
  bg := public.trade_form_group(b.data->'entries', t.target_pokemon_id::text);
  -- Legacy requests can only exchange single, unlinked entries.
  if (t.initiator_pokemon_data->'__linkedForms' is null and jsonb_array_length(ag) > 1)
     or (t.target_pokemon_data->'__linkedForms' is null and jsonb_array_length(bg) > 1) then
    raise exception 'Crea una nueva solicitud para incluir todas las formas enlazadas';
  end if;
  if (t.initiator_pokemon_data->'__linkedForms' is not null and
      (select jsonb_agg(p->>'id' order by p->>'id') from jsonb_array_elements(ag) p) is distinct from
      (select jsonb_agg(p->>'id' order by p->>'id') from jsonb_array_elements(t.initiator_pokemon_data->'__linkedForms') p))
     or (t.target_pokemon_data->'__linkedForms' is not null and
      (select jsonb_agg(p->>'id' order by p->>'id') from jsonb_array_elements(bg) p) is distinct from
      (select jsonb_agg(p->>'id' order by p->>'id') from jsonb_array_elements(t.target_pokemon_data->'__linkedForms') p)) then
    raise exception 'Han cambiado las formas enlazadas; crea una nueva solicitud';
  end if;
  if exists(select 1 from jsonb_array_elements(a.data->'entries') p
            join jsonb_array_elements(bg) incoming on p->>'id' = incoming->>'id')
     or exists(select 1 from jsonb_array_elements(b.data->'entries') p
            join jsonb_array_elements(ag) incoming on p->>'id' = incoming->>'id') then
    raise exception 'Incoming Pokemon already exists in destination';
  end if;
  -- Fresh group IDs prevent accidental links to unrelated destination entries.
  select jsonb_agg((p - '__boxId' - '__cloudBoxId' - '__boxName' - '__linkedForms' - 'linkGroupId')
         || jsonb_build_object('inTeam', false)
         || case when jsonb_array_length(ag) > 1 then jsonb_build_object('linkGroupId', new_ag) else '{}'::jsonb end)
    into ap from jsonb_array_elements(ag) p;
  select jsonb_agg((p - '__boxId' - '__cloudBoxId' - '__boxName' - '__linkedForms' - 'linkGroupId')
         || jsonb_build_object('inTeam', false)
         || case when jsonb_array_length(bg) > 1 then jsonb_build_object('linkGroupId', new_bg) else '{}'::jsonb end)
    into bp from jsonb_array_elements(bg) p;
  select coalesce(jsonb_agg(p order by ord), '[]'::jsonb) || bp into ae
    from jsonb_array_elements(a.data->'entries') with ordinality as e(p, ord)
    where not exists(select 1 from jsonb_array_elements(ag) outgoing where outgoing->>'id' = p->>'id');
  select coalesce(jsonb_agg(p order by ord), '[]'::jsonb) || ap into be
    from jsonb_array_elements(b.data->'entries') with ordinality as e(p, ord)
    where not exists(select 1 from jsonb_array_elements(bg) outgoing where outgoing->>'id' = p->>'id');
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

-- Keep already-open clients on the same safe implementation.
create or replace function public.create_trade_v2(p_trade jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select public.create_trade_v3(p_trade);
$$;
create or replace function public.accept_box_trade_v2(p_trade_id text)
returns jsonb language sql security invoker set search_path = '' as $$
  select public.accept_box_trade_v3(p_trade_id);
$$;

revoke all on function public.trade_form_group(jsonb,text) from public, anon, authenticated;
revoke all on function public.create_trade_v3(jsonb) from public, anon;
revoke all on function public.accept_box_trade_v3(text) from public, anon;
grant execute on function public.create_trade_v3(jsonb) to authenticated;
grant execute on function public.accept_box_trade_v3(text) to authenticated;
notify pgrst, 'reload schema';
commit;

