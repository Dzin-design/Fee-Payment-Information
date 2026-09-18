create table if not exists public.daily_entries (
  id uuid primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.daily_entries enable row level security;
grant select, insert, update, delete on public.daily_entries to anon;

drop policy if exists "Public can read daily entries" on public.daily_entries;
create policy "Public can read daily entries" on public.daily_entries for select to anon using (true);
drop policy if exists "Public can insert daily entries" on public.daily_entries;
create policy "Public can insert daily entries" on public.daily_entries for insert to anon with check (true);
drop policy if exists "Public can update daily entries" on public.daily_entries;
create policy "Public can update daily entries" on public.daily_entries for update to anon using (true) with check (true);
drop policy if exists "Public can delete daily entries" on public.daily_entries;
create policy "Public can delete daily entries" on public.daily_entries for delete to anon using (true);

create index if not exists daily_entries_created_at_idx on public.daily_entries(created_at);
