-- Run the entire file as postgres after 004. All fixtures roll back.
do $checks$
begin
  begin
    execute $batch$
      create temporary table bevve_contribution_check on commit drop as select
        gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() venue,
        gen_random_uuid() drink,gen_random_uuid() other_serving,
        least(x,y) first_request,greatest(x,y) next_request
        from (select gen_random_uuid() x,gen_random_uuid() y) ids;
      grant select on pg_temp.bevve_contribution_check to authenticated,anon;
      create function pg_temp.contribution_assert(ok boolean,label text) returns void language plpgsql as $$
      begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end;
      $$;
      create function pg_temp.contribution_denied(statement text,expected text) returns void language plpgsql as $$
      begin
        begin execute statement;
        exception when others then
          if sqlstate=expected then return; end if;
          raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;
        end;
        raise exception 'Statement unexpectedly succeeded: %',statement;
      end;
      $$;
      do $$ begin execute format('grant usage on schema %I to authenticated,anon',pg_my_temp_schema()::regnamespace); end $$;
      grant execute on function pg_temp.contribution_assert(boolean,text),pg_temp.contribution_denied(text,text) to authenticated,anon;
      insert into auth.users(id,email,raw_user_meta_data)
        select a,'contribution-a-'||a||'@example.invalid','{"username":"Contribution A"}'::jsonb from pg_temp.bevve_contribution_check
        union all select b,'contribution-b-'||b||'@example.invalid','{"username":"Contribution B"}'::jsonb from pg_temp.bevve_contribution_check;
      insert into public.bars(id,name,address,latitude,longitude,is_demo)
        select venue,'Contribution test','Test address',0,0,true from pg_temp.bevve_contribution_check;
      insert into public.drinks(id,name,category,serving_ml)
        select drink,'Same beer','beer',330 from pg_temp.bevve_contribution_check
        union all select other_serving,'Same beer','beer',500 from pg_temp.bevve_contribution_check;
      set local role authenticated;
      select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true) from pg_temp.bevve_contribution_check;
      select pg_temp.contribution_denied('select * from public.submit_crowd_report(null,(select venue from pg_temp.bevve_contribution_check),3)','22023');
      select pg_temp.contribution_denied('select * from public.submit_crowd_report(gen_random_uuid(),(select venue from pg_temp.bevve_contribution_check),6)','22023');
      select * from public.submit_crowd_report((select first_request from pg_temp.bevve_contribution_check),(select venue from pg_temp.bevve_contribution_check),2);
      select * from public.submit_crowd_report((select first_request from pg_temp.bevve_contribution_check),(select venue from pg_temp.bevve_contribution_check),2);
      select pg_temp.contribution_assert((select count(*)=1 and bool_and(user_id=(select a from pg_temp.bevve_contribution_check) and created_at>=transaction_timestamp()) from public.crowd_reports), 'crowd retries create one owner-bound report with server time');
      select pg_temp.contribution_denied('select * from public.submit_crowd_report((select first_request from pg_temp.bevve_contribution_check),(select venue from pg_temp.bevve_contribution_check),4)','22023');
      select * from public.submit_crowd_report((select next_request from pg_temp.bevve_contribution_check),(select venue from pg_temp.bevve_contribution_check),5);
      select pg_temp.contribution_assert((select count(*)=2 from public.crowd_reports), 'new reports append history');
      select pg_temp.contribution_assert((select report_count=1 and classification is null and score=5 from public.get_bar_crowd((select venue from pg_temp.bevve_contribution_check))), 'only latest report per user counts, without fabricating consensus');

      insert into public.bathroom_reviews(user_id,bar_id,cleanliness) select a,venue,3 from pg_temp.bevve_contribution_check;
      select pg_temp.contribution_assert((select accessibility is null and wait_time is null from public.bathroom_reviews), 'legacy unknown bathroom categories remain null');
      insert into public.bathroom_reviews(user_id,bar_id,cleanliness,accessibility,wait_time) select a,venue,5,4,3 from pg_temp.bevve_contribution_check
        on conflict(bar_id,user_id) do update set cleanliness=excluded.cleanliness,accessibility=excluded.accessibility,wait_time=excluded.wait_time;
      select pg_temp.contribution_assert((select count(*)=1 and bool_and(cleanliness=5 and accessibility=4 and wait_time=3 and updated_at>=created_at) from public.bathroom_reviews), 'bathroom edits replace one owner review');
      select pg_temp.contribution_assert((select review_count=1 and cleanliness=5 and accessibility=4 and wait_time=3 from public.get_bathroom_summary((select venue from pg_temp.bevve_contribution_check))), 'bathroom summary reflects saved ratings');

      select pg_temp.contribution_denied('select * from public.submit_drink_price(gen_random_uuid(),(select venue from pg_temp.bevve_contribution_check),(select drink from pg_temp.bevve_contribution_check),49)','22023');
      select pg_temp.contribution_denied('select * from public.submit_drink_price(gen_random_uuid(),(select venue from pg_temp.bevve_contribution_check),(select drink from pg_temp.bevve_contribution_check),10001)','22023');
      select pg_temp.contribution_denied('select * from public.submit_drink_price(gen_random_uuid(),(select venue from pg_temp.bevve_contribution_check),gen_random_uuid(),650)','23503');
      select * from public.submit_drink_price((select first_request from pg_temp.bevve_contribution_check),(select venue from pg_temp.bevve_contribution_check),(select drink from pg_temp.bevve_contribution_check),650);
      select * from public.submit_drink_price((select first_request from pg_temp.bevve_contribution_check),(select venue from pg_temp.bevve_contribution_check),(select drink from pg_temp.bevve_contribution_check),650);
      select pg_temp.contribution_assert((select count(*)=1 and bool_and(submitted_by=(select a from pg_temp.bevve_contribution_check) and currency='EUR' and observed_at>=transaction_timestamp()) from public.get_my_drink_prices()), 'price retries create one private owner-bound EUR observation with server time');
      select pg_temp.contribution_denied('select * from public.submit_drink_price((select first_request from pg_temp.bevve_contribution_check),(select venue from pg_temp.bevve_contribution_check),(select other_serving from pg_temp.bevve_contribution_check),650)','22023');
      select pg_temp.contribution_denied('select * from public.submit_drink_price((select first_request from pg_temp.bevve_contribution_check),(select venue from pg_temp.bevve_contribution_check),(select drink from pg_temp.bevve_contribution_check),750)','22023');
      select * from public.submit_drink_price((select next_request from pg_temp.bevve_contribution_check),(select venue from pg_temp.bevve_contribution_check),(select drink from pg_temp.bevve_contribution_check),750);
      select * from public.submit_drink_price(gen_random_uuid(),(select venue from pg_temp.bevve_contribution_check),(select other_serving from pg_temp.bevve_contribution_check),950);
      select pg_temp.contribution_assert((select count(*)=3 from public.get_my_drink_prices()), 'price corrections retain earlier observations');
      select pg_temp.contribution_assert((select (q->>'price_cents')::int=750 and (q->>'serving_ml')::int=330 from public.get_venue_catalog(),lateral jsonb_array_elements(venue->'drinks') q
        where venue->>'id'=(select venue::text from pg_temp.bevve_contribution_check) and q->>'id'=(select drink::text from pg_temp.bevve_contribution_check)), 'public latest price uses exact database drink and serving');
      select pg_temp.contribution_denied('select * from public.drink_prices','42501');
      select pg_temp.contribution_denied('select * from public.get_my_drink_prices(-1)','22023');
      select pg_temp.contribution_assert((select count(*)=0 from public.bar_comparisons), 'contributions create no ranking votes');
      select set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true) from pg_temp.bevve_contribution_check;
      select pg_temp.contribution_assert((select count(*)=0 from public.get_my_drink_prices()), 'price history excludes other owners');
      select pg_temp.contribution_assert((select count(*)=0 from public.crowd_reports), 'crowd history excludes other owners');
      select pg_temp.contribution_assert((select count(*)=0 from public.bathroom_reviews), 'review reads used for prefilling exclude other owners');
      select pg_temp.contribution_denied('select * from public.submit_crowd_report((select first_request from pg_temp.bevve_contribution_check),(select venue from pg_temp.bevve_contribution_check),2)','22023');
      select pg_temp.contribution_denied('select * from public.submit_drink_price((select first_request from pg_temp.bevve_contribution_check),(select venue from pg_temp.bevve_contribution_check),(select drink from pg_temp.bevve_contribution_check),650)','22023');
      update public.bathroom_reviews set cleanliness=1 where bar_id=(select venue from pg_temp.bevve_contribution_check);
      reset role;
      select pg_temp.contribution_assert((select cleanliness=5 from public.bathroom_reviews where bar_id=(select venue from pg_temp.bevve_contribution_check)), 'another account cannot edit a bathroom review');
      set local role authenticated;
      select set_config('request.jwt.claims','{}',true);
      select pg_temp.contribution_denied('select * from public.get_my_drink_prices()','42501');
      select pg_temp.contribution_denied('select * from public.submit_crowd_report(gen_random_uuid(),(select venue from pg_temp.bevve_contribution_check),2)','42501');
      select pg_temp.contribution_denied('select * from public.submit_drink_price(gen_random_uuid(),(select venue from pg_temp.bevve_contribution_check),(select drink from pg_temp.bevve_contribution_check),650)','42501');
      set local role anon;
      select pg_temp.contribution_denied('select * from public.get_my_drink_prices()','42501');
      select pg_temp.contribution_denied('select * from public.submit_crowd_report(gen_random_uuid(),(select venue from pg_temp.bevve_contribution_check),2)','42501');
      select pg_temp.contribution_denied('select * from public.submit_drink_price(gen_random_uuid(),(select venue from pg_temp.bevve_contribution_check),(select drink from pg_temp.bevve_contribution_check),650)','42501');
      reset role;
    $batch$;
    raise exception using errcode='BV004',message='Checks complete';
  exception when sqlstate 'BV004' then null;
  end;
end
$checks$;
select 'Venue contribution checks passed. All test data was rolled back.' as result;
