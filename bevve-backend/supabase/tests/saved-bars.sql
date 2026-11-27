-- Run as postgres after migration 007. All fixtures roll back on success or failure.
do $checks$
begin
  begin
    execute $batch$
      create temporary table saved_bar_check on commit drop as select gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() bar;
      grant select on pg_temp.saved_bar_check to authenticated,anon;
      do $$ begin execute format('grant usage on schema %I to authenticated,anon',pg_my_temp_schema()::regnamespace); end $$;
      create function pg_temp.saved_assert(ok boolean,label text) returns void language plpgsql as $$
      begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end; $$;
      create function pg_temp.saved_denied(statement text,expected text) returns void language plpgsql as $$
      begin
        begin execute statement;
        exception when others then
          if sqlstate=expected then return; end if;
          raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;
        end;
        raise exception 'Statement unexpectedly succeeded: %',statement;
      end; $$;
      grant execute on function pg_temp.saved_assert(boolean,text),pg_temp.saved_denied(text,text) to authenticated,anon;
      insert into auth.users(id,email,raw_user_meta_data)
        select a,'saved-a-'||a||'@example.invalid','{"username":"Saved A"}'::jsonb from pg_temp.saved_bar_check
        union all select b,'saved-b-'||b||'@example.invalid','{"username":"Saved B"}'::jsonb from pg_temp.saved_bar_check;
      insert into public.bars(id,name,address,latitude,longitude,is_demo)
        select bar,'Saved bar test','Test address',45.46,9.19,false from pg_temp.saved_bar_check;
      set local role authenticated;
      select set_config('request.jwt.claims',jsonb_build_object('sub',a)::text,true) from pg_temp.saved_bar_check;
      insert into public.saved_bars(user_id,bar_id) select a,bar from pg_temp.saved_bar_check;
      select pg_temp.saved_assert((select count(*)=1 and bool_and(created_at is not null) from public.saved_bars),'owner can save and read with server timestamps');
      select pg_temp.saved_denied('insert into public.saved_bars(user_id,bar_id) select a,bar from pg_temp.saved_bar_check','23505');
      select pg_temp.saved_denied('insert into public.saved_bars(user_id,bar_id) select b,bar from pg_temp.saved_bar_check','42501');
      select pg_temp.saved_denied('insert into public.saved_bars(user_id,bar_id,created_at) select a,bar,now() from pg_temp.saved_bar_check','42501');
      select pg_temp.saved_denied('update public.saved_bars set created_at=now()','42501');
      select pg_temp.saved_assert((select count(*)=0 from public.venue_impressions),'saving creates no impression');
      select pg_temp.saved_assert((select count(*)=0 from public.bar_comparisons),'saving creates no comparison');
      select set_config('request.jwt.claims',jsonb_build_object('sub',b)::text,true) from pg_temp.saved_bar_check;
      select pg_temp.saved_assert((select count(*)=0 from public.saved_bars),'saved bars are private to their owner');
      delete from public.saved_bars where user_id=(select a from pg_temp.saved_bar_check);
      insert into public.saved_bars(user_id,bar_id) select b,bar from pg_temp.saved_bar_check;
      select set_config('request.jwt.claims',jsonb_build_object('sub',a)::text,true) from pg_temp.saved_bar_check;
      select pg_temp.saved_assert((select count(*)=1 from public.saved_bars),'other accounts cannot remove a saved bar');
      insert into public.venue_impressions(user_id,bar_id,impression) select a,bar,'liked' from pg_temp.saved_bar_check;
      select pg_temp.saved_assert((select count(*)=1 from public.saved_bars),'rating keeps the saved bar');
      delete from public.saved_bars where user_id=(select a from pg_temp.saved_bar_check);
      delete from public.saved_bars where user_id=(select a from pg_temp.saved_bar_check);
      select pg_temp.saved_assert((select count(*)=0 from public.saved_bars),'removing a saved bar is repeatable');
      select pg_temp.saved_assert((select count(*)=1 from public.venue_impressions),'removing keeps the rating');
      set local role anon;
      select set_config('request.jwt.claims','{}',true);
      select pg_temp.saved_denied('select * from public.saved_bars','42501');
      select pg_temp.saved_denied('insert into public.saved_bars(user_id,bar_id) select a,bar from pg_temp.saved_bar_check','42501');
      reset role;
      delete from auth.users where id=(select b from pg_temp.saved_bar_check);
      select pg_temp.saved_assert((select count(*)=0 from public.saved_bars),'account deletion clears saved bars');
    $batch$;
    raise exception using errcode='BV007',message='Checks complete';
  exception when sqlstate 'BV007' then null;
  end;
end
$checks$;
select 'Saved bar checks passed. All test data was rolled back.' as result;
