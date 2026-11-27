-- Run after 006_account_safety.sql. Bookmarks are private and independent of ratings.
begin;

create table public.saved_bars (
  user_id uuid not null references public.profiles(id) on delete cascade,
  bar_id uuid not null references public.bars(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, bar_id)
);
create index saved_bars_owner_date on public.saved_bars(user_id, created_at desc, bar_id);

alter table public.saved_bars enable row level security;
revoke all on public.saved_bars from public, anon, authenticated;
grant select, delete on public.saved_bars to authenticated;
grant insert(user_id, bar_id) on public.saved_bars to authenticated;
create policy saved_bars_read_own on public.saved_bars for select to authenticated
  using (user_id = (select auth.uid()));
create policy saved_bars_insert_own on public.saved_bars for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy saved_bars_delete_own on public.saved_bars for delete to authenticated
  using (user_id = (select auth.uid()));

notify pgrst, 'reload schema';
commit;
