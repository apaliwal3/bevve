-- Run once after 001_backend.sql. Existing catalog rows and contributions remain.
begin;

alter table public.bars
  add column area text,
  add column city text,
  add column vibe text,
  add column image_url text check(image_url is null or image_url ~ '^https://'),
  add column opening_hours_label text,
  add column is_popular boolean not null default false;

create table public.venue_impressions (
  user_id uuid not null references public.profiles on delete cascade,
  bar_id uuid not null references public.bars,
  impression text not null check(impression in ('liked','fine','disliked')),
  eligible_for_community boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,bar_id)
);
create index on public.venue_impressions(bar_id) where eligible_for_community;
create function private.touch_impression() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end;
$$;
revoke all on function private.touch_impression() from public;
create trigger touch_impression before update on public.venue_impressions
for each row execute function private.touch_impression();

alter table public.venue_impressions enable row level security;
revoke all on public.venue_impressions from anon, authenticated;
grant select on public.venue_impressions to authenticated;
grant insert(user_id,bar_id,impression) on public.venue_impressions to authenticated;
grant update(user_id,bar_id,impression) on public.venue_impressions to authenticated;
create policy impressions_read_own on public.venue_impressions for select to authenticated
  using(user_id = (select auth.uid()));
create policy impressions_insert_own on public.venue_impressions for insert to authenticated
  with check(user_id = (select auth.uid()));
create policy impressions_update_own on public.venue_impressions for update to authenticated
  using(user_id = (select auth.uid())) with check(user_id = (select auth.uid()));

-- Only aggregate counts leave the ownership boundary. Demo venues never supply
-- a purported real community percentage; personal impressions still persist.
create function public.get_venue_opinions(p_bar_id uuid)
returns table(available boolean,liked_count bigint,fine_count bigint,disliked_count bigint,total_opinions bigint,liked_percentage numeric)
language sql stable security definer set search_path = '' as $$
  select not b.is_demo,
    count(i.user_id) filter(where i.impression = 'liked'),
    count(i.user_id) filter(where i.impression = 'fine'),
    count(i.user_id) filter(where i.impression = 'disliked'),
    count(i.user_id),
    100.0 * count(i.user_id) filter(where i.impression = 'liked') / nullif(count(i.user_id),0)
  from public.bars b left join public.venue_impressions i
    on i.bar_id = b.id and i.eligible_for_community and not b.is_demo
  where b.id = p_bar_id group by b.id,b.is_demo;
$$;

-- One page supplies catalog metadata and public summaries without exposing raw
-- contributor identities. IDs/servings come from the database, never fixtures.
create function public.get_venue_catalog(p_offset integer default 0)
returns table(venue jsonb) language plpgsql stable security definer set search_path = '' as $$
begin
  if p_offset < 0 or p_offset is null then
    raise exception 'Invalid catalog offset' using errcode = '22023';
  end if;
  return query
  select to_jsonb(b) || jsonb_build_object(
    'crowd', (select to_jsonb(c) from public.get_bar_crowd(b.id) c),
    'bathrooms', (select to_jsonb(r) from public.get_bathroom_summary(b.id) r),
    'opinions', (select to_jsonb(o) from public.get_venue_opinions(b.id) o),
    'languages', coalesce((select jsonb_agg(jsonb_build_object('code',l.language_code) order by l.language_code)
      from public.bar_languages l where l.bar_id = b.id),'[]'::jsonb),
    'drinks', coalesce((select jsonb_agg(to_jsonb(q) order by q.name,q.id) from (
      select distinct on(d.name,d.id) d.id,d.name,d.category,d.serving_ml,p.price_cents,p.currency,p.observed_at
      from public.drink_prices p join public.drinks d on d.id = p.drink_id
      where p.bar_id = b.id and p.currency = 'EUR'
      order by d.name,d.id,p.observed_at desc,p.id desc
    ) q),'[]'::jsonb)
  )
  from (select * from public.bars order by name,id offset p_offset limit 50) b
  order by b.name,b.id;
end;
$$;
revoke all on function public.get_venue_opinions(uuid),public.get_venue_catalog(integer) from public,anon;
grant execute on function public.get_venue_opinions(uuid),public.get_venue_catalog(integer) to authenticated;
notify pgrst, 'reload schema';
commit;
