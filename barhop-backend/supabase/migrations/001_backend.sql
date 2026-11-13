begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 username text not null check (length(trim(username)) between 1 and 40),
 preferred_language text not null default 'en' check (preferred_language in ('en','it')),
 created_at timestamptz not null default now()
);
create table private.moderators (user_id uuid primary key references auth.users on delete cascade);
create function private.is_moderator() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from private.moderators where user_id = auth.uid());
$$;
revoke all on function private.is_moderator() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_moderator() to authenticated;

create function private.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id, username) values (new.id,
   left(coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), 'BarHop user'),40));
 return new;
end;
$$;
revoke all on function private.create_profile() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.create_profile();

create table public.bars (
 id uuid primary key default gen_random_uuid(), name text not null, address text not null,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 is_demo boolean not null default false, created_at timestamptz not null default now()
);
create table public.drinks (
 id uuid primary key default gen_random_uuid(), name text not null, category text not null,
 serving_ml integer not null check(serving_ml > 0)
);
create table public.drink_prices (
 id uuid primary key default gen_random_uuid(), bar_id uuid not null references public.bars,
 drink_id uuid not null references public.drinks, price_cents integer not null check(price_cents >= 0),
 currency text not null default 'EUR' check(currency ~ '^[A-Z]{3}$'),
 submitted_by uuid references public.profiles on delete set null,
 observed_at timestamptz not null default now()
);
create table public.crowd_reports (
 id uuid primary key default gen_random_uuid(), bar_id uuid not null references public.bars,
 user_id uuid not null references public.profiles on delete cascade,
 level integer not null check(level between 1 and 5), created_at timestamptz not null default now()
);
create table public.bathroom_reviews (
 id uuid primary key default gen_random_uuid(), bar_id uuid not null references public.bars,
 user_id uuid not null references public.profiles on delete cascade,
 cleanliness integer not null check(cleanliness between 1 and 5),
 accessibility integer check(accessibility between 1 and 5), wait_time integer check(wait_time between 1 and 5),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(bar_id,user_id)
);
create function private.touch_review() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function private.touch_review() from public;
create trigger touch_review before update on public.bathroom_reviews for each row execute function private.touch_review();
create table public.bar_comparisons (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade,
 winner_bar_id uuid not null references public.bars, loser_bar_id uuid not null references public.bars,
 created_at timestamptz not null default now(), check(winner_bar_id <> loser_bar_id)
);
create table public.bar_languages (
 bar_id uuid not null references public.bars, language_code text not null,
 evidence_type text not null default 'community' check(evidence_type in ('community','venue','demo')),
 primary key(bar_id,language_code)
);
create table public.incident_reports (
 id uuid primary key default gen_random_uuid(), bar_id uuid not null references public.bars,
 reporter_id uuid references public.profiles on delete set null,
 category text not null check(length(trim(category)) between 1 and 80),
 description text not null check(length(trim(description)) between 1 and 4000),
 occurred_at timestamptz check(occurred_at <= now()),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 reviewed_by uuid references public.profiles on delete set null
);
-- No reporter identity, private description, or internal report ID is published.
create table public.published_incidents (
 id uuid primary key default gen_random_uuid(), bar_id uuid not null references public.bars,
 summary text not null check(length(trim(summary)) between 1 and 1000),
 verification_status text not null default 'moderator_reviewed'
   check(verification_status = 'moderator_reviewed'),
 published_at timestamptz not null default now()
);
create table private.incident_publications (
 report_id uuid primary key references public.incident_reports,
 publication_id uuid unique not null references public.published_incidents
);
create index on public.crowd_reports(bar_id,user_id,created_at desc,id desc);
create index on public.drink_prices(bar_id,drink_id,currency,observed_at desc,id desc);
create index on public.bar_comparisons(user_id,created_at,id);
create index on public.incident_reports(reporter_id);
create index on public.published_incidents(bar_id,published_at desc);

-- Remove broad default privileges. Grant only columns callers need to write.
do $$ declare t text; begin
 foreach t in array array['profiles','bars','drinks','drink_prices','crowd_reports','bathroom_reviews',
 'bar_comparisons','bar_languages','incident_reports','published_incidents'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
grant select on public.profiles, public.bars, public.drinks, public.bar_languages,
 public.crowd_reports, public.bathroom_reviews, public.bar_comparisons,
 public.incident_reports, public.published_incidents to authenticated;
grant update(username,preferred_language) on public.profiles to authenticated;
grant insert(bar_id,drink_id,price_cents,currency,submitted_by) on public.drink_prices to authenticated;
grant insert(bar_id,user_id,level) on public.crowd_reports to authenticated;
grant insert(bar_id,user_id,cleanliness,accessibility,wait_time) on public.bathroom_reviews to authenticated;
grant update(bar_id,user_id,cleanliness,accessibility,wait_time) on public.bathroom_reviews to authenticated;
grant insert(user_id,winner_bar_id,loser_bar_id) on public.bar_comparisons to authenticated;
grant insert(bar_id,reporter_id,category,description,occurred_at) on public.incident_reports to authenticated;

create policy profile_read on public.profiles for select to authenticated using(id = (select auth.uid()));
create policy profile_edit on public.profiles for update to authenticated using(id = (select auth.uid())) with check(id = (select auth.uid()));
create policy bars_read on public.bars for select to authenticated using(true);
create policy drinks_read on public.drinks for select to authenticated using(true);
create policy languages_read on public.bar_languages for select to authenticated using(true);
create policy prices_submit on public.drink_prices for insert to authenticated with check(submitted_by = (select auth.uid()));
create policy crowd_read_own on public.crowd_reports for select to authenticated using(user_id = (select auth.uid()));
create policy crowd_submit on public.crowd_reports for insert to authenticated with check(user_id = (select auth.uid()));
create policy bathroom_read_own on public.bathroom_reviews for select to authenticated using(user_id = (select auth.uid()));
create policy bathroom_submit on public.bathroom_reviews for insert to authenticated with check(user_id = (select auth.uid()));
create policy bathroom_edit on public.bathroom_reviews for update to authenticated using(user_id = (select auth.uid())) with check(user_id = (select auth.uid()));
create policy comparisons_read on public.bar_comparisons for select to authenticated using(user_id = (select auth.uid()));
create policy comparisons_submit on public.bar_comparisons for insert to authenticated with check(user_id = (select auth.uid()));
create policy incidents_read on public.incident_reports for select to authenticated using(reporter_id = (select auth.uid()) or (select private.is_moderator()));
create policy incidents_submit on public.incident_reports for insert to authenticated with check(reporter_id = (select auth.uid()));
create policy publications_read on public.published_incidents for select to authenticated using(true);

-- Definer functions intentionally read across user-owned records, exposing only aggregates.
create function public.get_bar_crowd(p_bar_id uuid)
returns table(score numeric, report_count bigint, newest_report_at timestamptz, classification text)
language sql stable security definer set search_path = '' as $$
 with latest as (
 select distinct on(user_id) level,created_at from public.crowd_reports
 where bar_id = p_bar_id and created_at >= now() - interval '45 minutes' and created_at <= now()
 order by user_id,created_at desc,id desc
 ), aggregate as (select avg(level) score,count(*) n,max(created_at) newest from latest)
 select score,n,newest,case when n < 3 then null when score < 2 then 'quiet'
 when score < 3.5 then 'moderate' else 'busy' end from aggregate;
$$;
create function public.get_bathroom_summary(p_bar_id uuid)
returns table(review_count bigint,cleanliness numeric,accessibility numeric,wait_time numeric,
 accessibility_count bigint,wait_time_count bigint)
language sql stable security definer set search_path = '' as $$
 select count(*),avg(cleanliness),avg(accessibility),avg(wait_time),count(accessibility),count(wait_time)
 from public.bathroom_reviews where bar_id = p_bar_id;
$$;
create function public.compare_drink_prices(p_drink_id uuid,p_bar_ids uuid[],p_currency text default 'EUR')
returns table(bar_id uuid,price_cents integer,currency text,observed_at timestamptz)
language sql stable security definer set search_path = '' as $$
 select distinct on(p.bar_id) p.bar_id,p.price_cents,p.currency,p.observed_at
 from public.drink_prices p where p.drink_id = p_drink_id and p.bar_id = any(p_bar_ids)
 and p.currency = p_currency order by p.bar_id,p.observed_at desc,p.id desc;
$$;
create function public.moderate_incident(p_report_id uuid,p_decision text,p_summary text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare report public.incident_reports; publication uuid;
begin
 if not private.is_moderator() then raise exception 'Moderator access required' using errcode = '42501'; end if;
 if p_decision is null or p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
 select * into report from public.incident_reports where id = p_report_id for update;
 if not found then raise exception 'Report not found'; end if;
 if report.status <> 'pending' then raise exception 'Report already reviewed'; end if;
 if p_decision = 'approved' then
   if p_summary is null or length(trim(p_summary)) not between 1 and 1000 then raise exception 'A public summary is required'; end if;
   insert into public.published_incidents(bar_id,summary) values(report.bar_id,trim(p_summary)) returning id into publication;
   insert into private.incident_publications values(p_report_id,publication);
 end if;
 update public.incident_reports set status = p_decision,reviewed_at = now(),reviewed_by = auth.uid() where id = p_report_id;
end;
$$;
revoke all on function public.get_bar_crowd(uuid),public.get_bathroom_summary(uuid),
 public.compare_drink_prices(uuid,uuid[],text),public.moderate_incident(uuid,text,text) from public,anon;
grant execute on function public.get_bar_crowd(uuid),public.get_bathroom_summary(uuid),
 public.compare_drink_prices(uuid,uuid[],text),public.moderate_incident(uuid,text,text) to authenticated;
commit;
