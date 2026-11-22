-- Run this ENTIRE file in the Supabase SQL Editor as postgres.
-- Requires the existing 001_backend.sql migration.
-- All dependent statements execute in one SQL command. A caught exception rolls
-- back the test subtransaction on success; a real failure rolls it back too.
-- No users, contributions, or helper functions remain after this check.
do $bevve_checks$
begin
  begin
    execute $bevve_batch$
create temporary table bevve_access_check_ids on commit drop as
select gen_random_uuid() a, gen_random_uuid() b, gen_random_uuid() moderator,
  gen_random_uuid() bar, gen_random_uuid() other_bar, gen_random_uuid() drink,
  null::uuid old_crowd, null::uuid incident;
grant select, update on pg_temp.bevve_access_check_ids to authenticated, anon;

create function pg_temp.check_true(ok boolean, label text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;
create function pg_temp.check_failure(statement text, expected_state text, label text) returns void
language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then
      raise notice 'PASS: %', label;
      return;
    end if;
    raise exception 'FAIL: % (expected SQLSTATE %, got %: %)', label, expected_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: % (statement unexpectedly succeeded)', label;
end;
$$;
do $$ begin
  execute format('grant usage on schema %I to authenticated, anon', pg_my_temp_schema()::regnamespace);
end $$;
grant execute on function pg_temp.check_true(boolean,text), pg_temp.check_failure(text,text,text) to authenticated, anon;

-- No emails are sent: these database-only test users exist within this transaction.
insert into auth.users(id, email, raw_user_meta_data)
select a, 'bevve-check-a-' || a || '@example.invalid', '{"username":"Check A"}'::jsonb from pg_temp.bevve_access_check_ids
union all select b, 'bevve-check-b-' || b || '@example.invalid', '{"username":"Check B"}'::jsonb from pg_temp.bevve_access_check_ids
union all select moderator, 'bevve-check-m-' || moderator || '@example.invalid', '{"username":"Check M"}'::jsonb from pg_temp.bevve_access_check_ids;
insert into private.moderators(user_id) select moderator from pg_temp.bevve_access_check_ids;
insert into public.bars(id,name,address,latitude,longitude,is_demo)
select bar, 'Temporary access check A', 'Temporary fixture', 45.46, 9.19, true from pg_temp.bevve_access_check_ids
union all select other_bar, 'Temporary access check B', 'Temporary fixture', 45.46, 9.19, true from pg_temp.bevve_access_check_ids;
insert into public.drinks(id,name,category,serving_ml)
select drink, 'Temporary access check drink', 'test', 330 from pg_temp.bevve_access_check_ids;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', a, 'role', 'authenticated')::text, true) from pg_temp.bevve_access_check_ids;
select pg_temp.check_true((select count(*) = 1 from public.profiles where id = (select a from pg_temp.bevve_access_check_ids)), 'signup trigger creates own profile');
select pg_temp.check_true((select count(*) = 0 from public.profiles where id = (select b from pg_temp.bevve_access_check_ids)), 'other profiles are private');
update public.profiles set username = 'Updated Check A', preferred_language = 'en' where id = (select a from pg_temp.bevve_access_check_ids);
select pg_temp.check_true((select username = 'Updated Check A' from public.profiles where id = (select a from pg_temp.bevve_access_check_ids)), 'own profile update');
select pg_temp.check_failure('update public.profiles set created_at = now()', '42501', 'profile timestamp protected');
select pg_temp.check_true((select count(*) = 2 from public.bars where id in (select bar from pg_temp.bevve_access_check_ids union all select other_bar from pg_temp.bevve_access_check_ids)), 'signed-in catalog reads');
select pg_temp.check_failure('insert into public.bars(name,address,latitude,longitude) values (''Forbidden'',''Forbidden'',0,0)', '42501', 'catalog writes denied');
select pg_temp.check_failure('select * from private.moderators', '42501', 'moderator allowlist is private');
select pg_temp.check_failure($sql$insert into public.crowd_reports(bar_id,user_id,level) select bar,b,3 from pg_temp.bevve_access_check_ids$sql$, '42501', 'cannot spoof another contributor');
select pg_temp.check_failure($sql$insert into public.crowd_reports(bar_id,user_id,level,created_at) select bar,a,3,now() from pg_temp.bevve_access_check_ids$sql$, '42501', 'crowd timestamps are server-controlled');
select pg_temp.check_failure($sql$insert into public.crowd_reports(bar_id,user_id,level) select bar,a,0 from pg_temp.bevve_access_check_ids$sql$, '23514', 'invalid crowd level rejected');
select pg_temp.check_true((select report_count = 0 and score is null and classification is null from public.get_bar_crowd((select bar from pg_temp.bevve_access_check_ids))), 'empty crowd summary');

with inserted as (
  insert into public.crowd_reports(bar_id,user_id,level) select bar,a,1 from pg_temp.bevve_access_check_ids returning id
) update pg_temp.bevve_access_check_ids set old_crowd = (select id from inserted);
reset role;
update public.crowd_reports set created_at = now() - interval '1 minute' where id = (select old_crowd from pg_temp.bevve_access_check_ids);
set local role authenticated;
insert into public.crowd_reports(bar_id,user_id,level) select bar,a,5 from pg_temp.bevve_access_check_ids;
select pg_temp.check_true((select report_count = 1 and score = 5 and classification is null from public.get_bar_crowd((select bar from pg_temp.bevve_access_check_ids))), 'crowd uses latest report per contributor');

insert into public.bathroom_reviews(bar_id,user_id,cleanliness,accessibility,wait_time) select bar,a,2,null,null from pg_temp.bevve_access_check_ids;
insert into public.bathroom_reviews(bar_id,user_id,cleanliness,accessibility,wait_time) select bar,a,5,null,null from pg_temp.bevve_access_check_ids
on conflict(bar_id,user_id) do update set cleanliness = excluded.cleanliness, accessibility = excluded.accessibility, wait_time = excluded.wait_time;
select pg_temp.check_true((select count(*) = 1 and min(cleanliness) = 5 from public.bathroom_reviews where bar_id = (select bar from pg_temp.bevve_access_check_ids)), 'bathroom upsert keeps one updated review');
select pg_temp.check_true((select review_count = 1 and cleanliness = 5 and accessibility is null and accessibility_count = 0 and wait_time is null and wait_time_count = 0 from public.get_bathroom_summary((select bar from pg_temp.bevve_access_check_ids))), 'unknown bathroom fields do not dilute averages');

insert into public.drink_prices(bar_id,drink_id,price_cents,currency,submitted_by) select bar,drink,650,'EUR',a from pg_temp.bevve_access_check_ids;
insert into public.drink_prices(bar_id,drink_id,price_cents,currency,submitted_by) select bar,drink,999,'USD',a from pg_temp.bevve_access_check_ids;
select pg_temp.check_true((select count(*) = 1 and min(price_cents) = 650 from public.compare_drink_prices((select drink from pg_temp.bevve_access_check_ids), array[(select bar from pg_temp.bevve_access_check_ids)], 'EUR')), 'price comparison isolates currency');
select pg_temp.check_failure('select * from public.drink_prices', '42501', 'raw price submitter identities are private');
select pg_temp.check_failure($sql$insert into public.drink_prices(bar_id,drink_id,price_cents,submitted_by) select bar,drink,-1,a from pg_temp.bevve_access_check_ids$sql$, '23514', 'negative prices rejected');
select pg_temp.check_failure($sql$insert into public.drink_prices(bar_id,drink_id,price_cents,submitted_by,observed_at) select bar,drink,500,a,now() from pg_temp.bevve_access_check_ids$sql$, '42501', 'price timestamps are server-controlled');
insert into public.bar_comparisons(user_id,winner_bar_id,loser_bar_id) select a,bar,other_bar from pg_temp.bevve_access_check_ids;
select pg_temp.check_failure($sql$insert into public.bar_comparisons(user_id,winner_bar_id,loser_bar_id) select b,bar,other_bar from pg_temp.bevve_access_check_ids$sql$, '42501', 'cannot spoof comparison owner');

with inserted as (
  insert into public.incident_reports(bar_id,reporter_id,category,description) select bar,a,'Other','Temporary private fixture' from pg_temp.bevve_access_check_ids returning id
) update pg_temp.bevve_access_check_ids set incident = (select id from inserted);
select pg_temp.check_failure($sql$insert into public.incident_reports(bar_id,reporter_id,category,description,status) select bar,a,'Other','Temporary fixture','approved' from pg_temp.bevve_access_check_ids$sql$, '42501', 'reporters cannot approve incidents');
select pg_temp.check_failure($sql$select public.moderate_incident((select incident from pg_temp.bevve_access_check_ids),'rejected',null)$sql$, '42501', 'ordinary users cannot moderate');

-- User B cannot read or change A's private records.
select set_config('request.jwt.claims', jsonb_build_object('sub', b, 'role', 'authenticated')::text, true) from pg_temp.bevve_access_check_ids;
select pg_temp.check_true((select count(*) = 0 from public.crowd_reports where user_id = (select a from pg_temp.bevve_access_check_ids)), 'other crowd reports are private');
select pg_temp.check_true((select count(*) = 0 from public.bathroom_reviews where user_id = (select a from pg_temp.bevve_access_check_ids)), 'other bathroom reviews are private');
select pg_temp.check_true((select count(*) = 0 from public.bar_comparisons where user_id = (select a from pg_temp.bevve_access_check_ids)), 'other comparisons are private');
select pg_temp.check_true((select count(*) = 0 from public.incident_reports where id = (select incident from pg_temp.bevve_access_check_ids)), 'other incidents are private');
with changed as (update public.bathroom_reviews set cleanliness = 1 where user_id = (select a from pg_temp.bevve_access_check_ids) returning id)
select pg_temp.check_true((select count(*) = 0 from changed), 'cannot update another user review');
insert into public.crowd_reports(bar_id,user_id,level) select bar,b,3 from pg_temp.bevve_access_check_ids;

-- Moderator M supplies the third crowd contributor and reviews A's incident.
select set_config('request.jwt.claims', jsonb_build_object('sub', moderator, 'role', 'authenticated')::text, true) from pg_temp.bevve_access_check_ids;
insert into public.crowd_reports(bar_id,user_id,level) select bar,moderator,1 from pg_temp.bevve_access_check_ids;
select pg_temp.check_true((select report_count = 3 and score = 3 and classification = 'moderate' from public.get_bar_crowd((select bar from pg_temp.bevve_access_check_ids))), 'three distinct recent accounts establish crowd classification');
select pg_temp.check_true((select count(*) = 1 from public.incident_reports where id = (select incident from pg_temp.bevve_access_check_ids)), 'moderator can read pending incident');
select pg_temp.check_failure($sql$select public.moderate_incident((select incident from pg_temp.bevve_access_check_ids),'approved',null)$sql$, 'P0001', 'approval requires a public summary');
select public.moderate_incident((select incident from pg_temp.bevve_access_check_ids),'approved','Temporary reviewed summary');
select pg_temp.check_true((select count(*) = 1 from public.published_incidents where bar_id = (select bar from pg_temp.bevve_access_check_ids)), 'approval publishes one reviewed summary');
select pg_temp.check_failure($sql$select public.moderate_incident((select incident from pg_temp.bevve_access_check_ids),'rejected',null)$sql$, 'P0001', 'a report cannot be reviewed twice');
select pg_temp.check_true((select count(*) = 0 from pg_attribute where attrelid = 'public.published_incidents'::regclass and attname in ('reporter_id','report_id','description') and not attisdropped), 'publication omits reporter identity and original description');

reset role;
update public.crowd_reports set created_at = now() - interval '46 minutes' where user_id = (select moderator from pg_temp.bevve_access_check_ids) and bar_id = (select bar from pg_temp.bevve_access_check_ids);
set local role authenticated;
select pg_temp.check_true((select report_count = 2 and classification is null from public.get_bar_crowd((select bar from pg_temp.bevve_access_check_ids))), 'expired contributor no longer establishes classification');

set local role anon;
select set_config('request.jwt.claims','{}',true);
select pg_temp.check_failure('select * from public.bars', '42501', 'signed-out catalog access denied');
select pg_temp.check_failure($sql$select * from public.get_bar_crowd((select bar from pg_temp.bevve_access_check_ids))$sql$, '42501', 'signed-out crowd RPC denied');
select pg_temp.check_failure($sql$select * from public.get_bathroom_summary((select bar from pg_temp.bevve_access_check_ids))$sql$, '42501', 'signed-out bathroom RPC denied');
select pg_temp.check_failure($sql$select * from public.compare_drink_prices((select drink from pg_temp.bevve_access_check_ids),array[(select bar from pg_temp.bevve_access_check_ids)],'EUR')$sql$, '42501', 'signed-out price RPC denied');
select pg_temp.check_failure($sql$select public.moderate_incident((select incident from pg_temp.bevve_access_check_ids),'rejected',null)$sql$, '42501', 'signed-out moderation denied');
reset role;

    $bevve_batch$;
    raise exception using errcode = 'BV001', message = 'Access checks complete';
  exception when sqlstate 'BV001' then
    null; -- Roll back successful test data and helper functions.
  end;
end
$bevve_checks$;
select 'All access checks passed. Temporary users, records, and helpers were rolled back.' as result;
