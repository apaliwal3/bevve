-- Run this entire file as postgres after migration 003. Fixtures roll back.
do $checks$
begin
  begin
    execute $batch$
      create temporary table bevve_comparison_check on commit drop as select
        gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() venue_a,
        gen_random_uuid() venue_b,gen_random_uuid() request;
      grant select on pg_temp.bevve_comparison_check to authenticated,anon;
      create function pg_temp.comparison_assert(ok boolean,label text) returns void language plpgsql as $$
      begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end;
      $$;
      create function pg_temp.comparison_denied(statement text,expected text) returns void language plpgsql as $$
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
      grant execute on function pg_temp.comparison_assert(boolean,text),pg_temp.comparison_denied(text,text) to authenticated,anon;
      insert into auth.users(id,email,raw_user_meta_data)
        select a,'comparison-a-'||a||'@example.invalid','{"username":"Comparison A"}'::jsonb from pg_temp.bevve_comparison_check
        union all select b,'comparison-b-'||b||'@example.invalid','{"username":"Comparison B"}'::jsonb from pg_temp.bevve_comparison_check;
      insert into public.bars(id,name,address,latitude,longitude,is_demo)
        select venue_a,'Comparison test A','Test address',0,0,true from pg_temp.bevve_comparison_check
        union all select venue_b,'Comparison test B','Test address',0,0,true from pg_temp.bevve_comparison_check;
      set local role authenticated;
      select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true) from pg_temp.bevve_comparison_check;
      select pg_temp.comparison_denied('select * from public.submit_personal_comparison((select request from pg_temp.bevve_comparison_check),(select venue_a from pg_temp.bevve_comparison_check),(select venue_b from pg_temp.bevve_comparison_check))','42501');
      insert into public.venue_impressions(user_id,bar_id,impression) select a,venue_a,'liked' from pg_temp.bevve_comparison_check;
      select pg_temp.comparison_denied('select * from public.submit_personal_comparison((select request from pg_temp.bevve_comparison_check),(select venue_a from pg_temp.bevve_comparison_check),(select venue_b from pg_temp.bevve_comparison_check))','42501');
      insert into public.venue_impressions(user_id,bar_id,impression) select a,venue_b,'fine' from pg_temp.bevve_comparison_check;
      select pg_temp.comparison_assert((select count(*)=0 from public.bar_comparisons), 'impressions alone create no votes');
      select pg_temp.comparison_denied('select * from public.submit_personal_comparison(null,(select venue_a from pg_temp.bevve_comparison_check),(select venue_b from pg_temp.bevve_comparison_check))','22023');
      select pg_temp.comparison_denied('select * from public.submit_personal_comparison((select request from pg_temp.bevve_comparison_check),(select venue_a from pg_temp.bevve_comparison_check),(select venue_a from pg_temp.bevve_comparison_check))','22023');
      select * from public.submit_personal_comparison((select request from pg_temp.bevve_comparison_check),(select venue_a from pg_temp.bevve_comparison_check),(select venue_b from pg_temp.bevve_comparison_check));
      select * from public.submit_personal_comparison((select request from pg_temp.bevve_comparison_check),(select venue_a from pg_temp.bevve_comparison_check),(select venue_b from pg_temp.bevve_comparison_check));
      select pg_temp.comparison_assert((select count(*)=1 and bool_and(user_id=(select a from pg_temp.bevve_comparison_check) and created_at>=transaction_timestamp()) from public.bar_comparisons), 'retry returns one immutable owner-bound vote with server time');
      select pg_temp.comparison_denied('select * from public.submit_personal_comparison((select request from pg_temp.bevve_comparison_check),(select venue_b from pg_temp.bevve_comparison_check),(select venue_a from pg_temp.bevve_comparison_check))','22023');
      select pg_temp.comparison_denied('update public.bar_comparisons set winner_bar_id=loser_bar_id','42501');
      select pg_temp.comparison_denied('insert into public.bar_comparisons(id,user_id,winner_bar_id,loser_bar_id,created_at) select gen_random_uuid(),a,venue_a,venue_b,now() from pg_temp.bevve_comparison_check','42501');
      select set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true) from pg_temp.bevve_comparison_check;
      select pg_temp.comparison_assert((select count(*)=0 from public.bar_comparisons), 'another account cannot read votes');
      select pg_temp.comparison_denied('select * from public.submit_personal_comparison((select request from pg_temp.bevve_comparison_check),(select venue_a from pg_temp.bevve_comparison_check),(select venue_b from pg_temp.bevve_comparison_check))','22023');
      select set_config('request.jwt.claims','{}',true);
      select pg_temp.comparison_denied('select * from public.submit_personal_comparison(gen_random_uuid(),(select venue_a from pg_temp.bevve_comparison_check),(select venue_b from pg_temp.bevve_comparison_check))','42501');
      set local role anon;
      select pg_temp.comparison_denied('select * from public.submit_personal_comparison(gen_random_uuid(),(select venue_a from pg_temp.bevve_comparison_check),(select venue_b from pg_temp.bevve_comparison_check))','42501');
      reset role;
    $batch$;
    raise exception using errcode='BV003',message='Checks complete';
  exception when sqlstate 'BV003' then null;
  end;
end
$checks$;
select 'Personal comparison checks passed. All test data was rolled back.' as result;
