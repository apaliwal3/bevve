-- Run the entire file as postgres after 002_catalog_impressions.sql.
-- Test records and helpers are rolled back on success or failure.
do $checks$
begin
  begin
    execute $batch$
      create temporary table bevve_catalog_check on commit drop as select
        gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() bar,gen_random_uuid() demo,
        gen_random_uuid() drink,gen_random_uuid() other_serving;
      grant select on pg_temp.bevve_catalog_check to authenticated,anon;
      create function pg_temp.catalog_assert(ok boolean,label text) returns void language plpgsql as $$
      begin
        if ok is distinct from true then raise exception 'FAIL: %',label; end if;
      end;
      $$;
      create function pg_temp.catalog_denied(statement text,expected text) returns void language plpgsql as $$
      begin
        begin execute statement;
        exception when others then
          if sqlstate = expected then return; end if;
          raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;
        end;
        raise exception 'Statement unexpectedly succeeded: %',statement;
      end;
      $$;
      do $$ begin execute format('grant usage on schema %I to authenticated,anon',pg_my_temp_schema()::regnamespace); end $$;
      grant execute on function pg_temp.catalog_assert(boolean,text),pg_temp.catalog_denied(text,text) to authenticated,anon;
      insert into auth.users(id,email,raw_user_meta_data)
        select a,'catalog-a-'||a||'@example.invalid','{"username":"Catalog A"}'::jsonb from pg_temp.bevve_catalog_check
        union all select b,'catalog-b-'||b||'@example.invalid','{"username":"Catalog B"}'::jsonb from pg_temp.bevve_catalog_check;
      insert into public.bars(id,name,address,latitude,longitude,is_demo,area,city,vibe,image_url)
        select bar,'Catalog test venue','Test address',45.46,9.19,false,'Test area','Test city','Test vibe','https://example.com/test.jpg' from pg_temp.bevve_catalog_check
        union all select demo,'Catalog demo venue','Test address',45.46,9.19,true,null,null,null,null from pg_temp.bevve_catalog_check;
      insert into public.drinks(id,name,category,serving_ml)
        select drink,'Test beer','beer',330 from pg_temp.bevve_catalog_check
        union all select other_serving,'Test beer','beer',500 from pg_temp.bevve_catalog_check;
      insert into public.drink_prices(bar_id,drink_id,price_cents,currency,submitted_by,observed_at)
        select bar,drink,400,'EUR',a,now()-interval '1 minute' from pg_temp.bevve_catalog_check
        union all select bar,drink,650,'EUR',a,now() from pg_temp.bevve_catalog_check
        union all select bar,drink,100,'USD',a,now() from pg_temp.bevve_catalog_check
        union all select bar,other_serving,900,'EUR',a,now() from pg_temp.bevve_catalog_check;
      set local role authenticated;
      select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true) from pg_temp.bevve_catalog_check;
      select pg_temp.catalog_assert((select (venue->>'area')='Test area' and jsonb_array_length(venue->'drinks')=2
        and not exists(select from jsonb_array_elements(venue->'drinks') q where q->>'submitted_by' is not null)
        from public.get_venue_catalog() where venue->>'id'=(select bar::text from pg_temp.bevve_catalog_check)), 'catalog metadata, exact servings and private identities');
      select pg_temp.catalog_assert((select (q->>'price_cents')::int=650
        from public.get_venue_catalog(),lateral jsonb_array_elements(venue->'drinks') q
        where venue->>'id'=(select bar::text from pg_temp.bevve_catalog_check) and q->>'id'=(select drink::text from pg_temp.bevve_catalog_check)), 'catalog uses newest EUR observation');
      select pg_temp.catalog_denied('select * from public.get_venue_catalog(-1)','22023');
      select pg_temp.catalog_assert((select available and total_opinions=0 and liked_percentage is null from public.get_venue_opinions((select bar from pg_temp.bevve_catalog_check))), 'real venue with zero opinions');
      insert into public.venue_impressions(user_id,bar_id,impression) select a,bar,'liked' from pg_temp.bevve_catalog_check;
      select pg_temp.catalog_assert((select total_opinions=1 and liked_percentage=100 from public.get_venue_opinions((select bar from pg_temp.bevve_catalog_check))), 'one eligible opinion is enough');
      select pg_temp.catalog_denied('insert into public.venue_impressions(user_id,bar_id,impression) select b,bar,''liked'' from pg_temp.bevve_catalog_check','42501');
      select pg_temp.catalog_denied('update public.venue_impressions set updated_at=now()','42501');
      select pg_temp.catalog_denied('update public.venue_impressions set eligible_for_community=false','42501');
      select pg_temp.catalog_denied('insert into public.venue_impressions(user_id,bar_id,impression) select a,demo,''invalid'' from pg_temp.bevve_catalog_check','23514');
      insert into public.venue_impressions(user_id,bar_id,impression) select a,bar,'disliked' from pg_temp.bevve_catalog_check
        on conflict(user_id,bar_id) do update set user_id=excluded.user_id,bar_id=excluded.bar_id,impression=excluded.impression;
      select pg_temp.catalog_assert((select count(*)=1 and min(impression)='disliked' and bool_and(updated_at>=created_at) from public.venue_impressions where bar_id=(select bar from pg_temp.bevve_catalog_check)), 'edits replace the existing impression with server time');
      select pg_temp.catalog_assert((select count(*)=0 from public.bar_comparisons), 'impressions create no comparison votes');
      insert into public.venue_impressions(user_id,bar_id,impression) select a,demo,'liked' from pg_temp.bevve_catalog_check;
      select pg_temp.catalog_assert((select not available and total_opinions=0 and liked_percentage is null from public.get_venue_opinions((select demo from pg_temp.bevve_catalog_check))), 'demo venues do not manufacture community opinions');
      select set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true) from pg_temp.bevve_catalog_check;
      select pg_temp.catalog_assert((select count(*)=0 from public.venue_impressions), 'another account cannot read saved impressions');
      update public.venue_impressions set impression='liked' where user_id=(select a from pg_temp.bevve_catalog_check);
      insert into public.venue_impressions(user_id,bar_id,impression) select b,bar,'fine' from pg_temp.bevve_catalog_check;
      select pg_temp.catalog_assert((select total_opinions=2 and liked_percentage=0 and disliked_count=1 and fine_count=1 from public.get_venue_opinions((select bar from pg_temp.bevve_catalog_check))), 'neutral/disliked opinions stay in the denominator and other users cannot edit them');
      reset role;
      update public.venue_impressions set eligible_for_community=false where user_id=(select b from pg_temp.bevve_catalog_check);
      set local role authenticated;
      select pg_temp.catalog_assert((select total_opinions=1 from public.get_venue_opinions((select bar from pg_temp.bevve_catalog_check))), 'server eligibility controls aggregation');
      set local role anon;
      select set_config('request.jwt.claims','{}',true);
      select pg_temp.catalog_denied('select * from public.venue_impressions','42501');
      select pg_temp.catalog_denied('select * from public.get_venue_catalog()','42501');
      select pg_temp.catalog_denied('select * from public.get_venue_opinions((select bar from pg_temp.bevve_catalog_check))','42501');
      reset role;
    $batch$;
    raise exception using errcode='BV002',message='Checks complete';
  exception when sqlstate 'BV002' then null;
  end;
end
$checks$;
select 'Catalog and impression checks passed. All test data was rolled back.' as result;
