create table if not exists app_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_snapshots enable row level security;

drop policy if exists "Users can read own snapshot" on app_snapshots;
create policy "Users can read own snapshot"
on app_snapshots for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own snapshot" on app_snapshots;
create policy "Users can insert own snapshot"
on app_snapshots for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own snapshot" on app_snapshots;
create policy "Users can update own snapshot"
on app_snapshots for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
