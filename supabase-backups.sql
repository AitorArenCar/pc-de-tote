create table if not exists public.poke_box_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  name text not null,
  reason text not null default 'manual',
  data jsonb not null,
  device_id text,
  created_at timestamptz not null default now()
);

alter table public.poke_box_backups enable row level security;

drop policy if exists "Users can read own poke box backups" on public.poke_box_backups;
create policy "Users can read own poke box backups"
on public.poke_box_backups
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create own poke box backups" on public.poke_box_backups;
create policy "Users can create own poke box backups"
on public.poke_box_backups
for insert
with check (auth.uid() = user_id);

create index if not exists poke_box_backups_user_created_idx
on public.poke_box_backups (user_id, created_at desc);
