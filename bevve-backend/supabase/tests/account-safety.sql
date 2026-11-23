-- Run the entire file as postgres after 006. All private/public fixtures roll back.
do $checks$
begin
  begin
    execute $batch$
      create temporary table bevve_safety_check on commit drop as select gen_random_uuid() a,gen_random_uuid() b,
        gen_random_uuid() moderator,gen_random_uuid() venue,gen_random_uuid() request,gen_random_uuid() reject_request;
      grant select on pg_temp.bevve_safety_check to authenticated,anon;
      create function pg_temp.safety_assert(ok boolean,label text) returns void language plpgsql as $$
      begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end;
      $$;
      create function pg_temp.safety_denied(statement text,expected text) returns void language plpgsql as $$
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
      grant execute on function pg_temp.safety_assert(boolean,text),pg_temp.safety_denied(text,text) to authenticated,anon;
      insert into auth.users(id,email,raw_user_meta_data)
        select a,'safety-a-'||a||'@example.invalid','{"username":"Safety A"}'::jsonb from pg_temp.bevve_safety_check
        union all select b,'safety-b-'||b||'@example.invalid','{"username":"Safety B"}'::jsonb from pg_temp.bevve_safety_check
        union all select moderator,'safety-m-'||moderator||'@example.invalid','{"username":"Safety Moderator"}'::jsonb from pg_temp.bevve_safety_check;
      insert into private.moderators select moderator from pg_temp.bevve_safety_check;
      insert into public.bars(id,name,address,latitude,longitude,is_demo)
        select venue,'Safety test','Test address',0,0,true from pg_temp.bevve_safety_check;
      set local role authenticated;
      select set_config('request.jwt.claims',jsonb_build_object('sub',a)::text,true) from pg_temp.bevve_safety_check;
      select pg_temp.safety_assert(not public.can_moderate_incidents(),'ordinary account has no review role');
      select pg_temp.safety_denied('select * from public.submit_incident_report(null,(select venue from pg_temp.bevve_safety_check),''Other'',''Private fixture'')','22023');
      select pg_temp.safety_denied('select * from public.submit_incident_report(gen_random_uuid(),(select venue from pg_temp.bevve_safety_check),''Invalid'',''Private fixture'')','22023');
      select pg_temp.safety_denied('select * from public.submit_incident_report(gen_random_uuid(),(select venue from pg_temp.bevve_safety_check),''Other'',''   '')','22023');
      select pg_temp.safety_denied('select * from public.submit_incident_report(gen_random_uuid(),(select venue from pg_temp.bevve_safety_check),''Other'',repeat(''x'',4001))','22023');
      select pg_temp.safety_denied('select * from public.submit_incident_report(gen_random_uuid(),(select venue from pg_temp.bevve_safety_check),''Other'',''Private fixture'',now()+interval ''1 day'')','22023');
      select pg_temp.safety_denied('select * from public.submit_incident_report(gen_random_uuid(),(select venue from pg_temp.bevve_safety_check),''Other'',''Private fixture'',''-infinity'')','22023');
      select pg_temp.safety_denied('select * from public.submit_incident_report(gen_random_uuid(),gen_random_uuid(),''Other'',''Private fixture'')','23503');
      select * from public.submit_incident_report((select request from pg_temp.bevve_safety_check),(select venue from pg_temp.bevve_safety_check),'Theft','  Private synthetic description  ',now()-interval '1 day');
      select * from public.submit_incident_report((select request from pg_temp.bevve_safety_check),(select venue from pg_temp.bevve_safety_check),'Theft','Private synthetic description',now()-interval '1 day');
      select pg_temp.safety_assert((select count(*)=1 and bool_and(reporter_id=auth.uid() and status='pending' and reviewed_at is null and description='Private synthetic description' and created_at>=transaction_timestamp()) from public.incident_reports),'submission retries keep one private owner-bound pending report');
      select pg_temp.safety_assert((select count(*)=0 from public.published_incidents where bar_id=(select venue from pg_temp.bevve_safety_check)),'private reports do not publish automatically');
      select pg_temp.safety_denied('select * from public.submit_incident_report((select request from pg_temp.bevve_safety_check),(select venue from pg_temp.bevve_safety_check),''Other'',''Private synthetic description'',now()-interval ''1 day'')','22023');
      select pg_temp.safety_denied('select * from public.submit_incident_report((select request from pg_temp.bevve_safety_check),(select venue from pg_temp.bevve_safety_check),''Theft'',''Changed description'',now()-interval ''1 day'')','22023');
      select pg_temp.safety_denied('select * from public.submit_incident_report((select request from pg_temp.bevve_safety_check),(select venue from pg_temp.bevve_safety_check),''Theft'',''Private synthetic description'',null)','22023');
      select pg_temp.safety_denied('update public.incident_reports set status=''approved''','42501');
      select pg_temp.safety_denied('delete from public.incident_reports','42501');
      select pg_temp.safety_denied('insert into public.published_incidents(bar_id,summary) select venue,''Unreviewed summary'' from pg_temp.bevve_safety_check','42501');
      select pg_temp.safety_denied('insert into private.moderators(user_id) select a from pg_temp.bevve_safety_check','42501');
      select pg_temp.safety_denied('select * from public.review_incident_report((select request from pg_temp.bevve_safety_check),''approved'',''Reviewed public summary'')','42501');
      select set_config('request.jwt.claims',jsonb_build_object('sub',b)::text,true) from pg_temp.bevve_safety_check;
      select pg_temp.safety_assert((select count(*)=0 from public.incident_reports),'other accounts cannot read private incident history');
      select pg_temp.safety_denied('select * from public.submit_incident_report((select request from pg_temp.bevve_safety_check),(select venue from pg_temp.bevve_safety_check),''Theft'',''Private synthetic description'',now()-interval ''1 day'')','22023');
      select * from public.submit_incident_report((select reject_request from pg_temp.bevve_safety_check),(select venue from pg_temp.bevve_safety_check),'Other','Another private synthetic description');

      select set_config('request.jwt.claims',jsonb_build_object('sub',moderator)::text,true) from pg_temp.bevve_safety_check;
      select pg_temp.safety_assert(public.can_moderate_incidents(),'registered moderator has review access');
      select pg_temp.safety_assert((select count(*)=2 from public.incident_reports where status='pending'),'moderator can inspect the private queue');
      select pg_temp.safety_assert((select count(*)=0 from public.incident_reports where reporter_id=auth.uid()),'moderator personal history excludes queue reports');
      select pg_temp.safety_denied('select * from public.review_incident_report((select request from pg_temp.bevve_safety_check),''approved'',null)','22023');
      select pg_temp.safety_denied('select * from public.review_incident_report((select request from pg_temp.bevve_safety_check),''approved'',''   '')','22023');
      select pg_temp.safety_denied('select * from public.review_incident_report((select request from pg_temp.bevve_safety_check),''approved'',repeat(''x'',1001))','22023');
      select pg_temp.safety_denied('select * from public.review_incident_report((select request from pg_temp.bevve_safety_check),''pending'',null)','22023');
      select pg_temp.safety_denied('select * from public.review_incident_report((select reject_request from pg_temp.bevve_safety_check),''rejected'',''Do not publish'')','22023');
      select pg_temp.safety_denied('select * from public.review_incident_report(gen_random_uuid(),''approved'',''Reviewed public summary'')','P0001');
      select pg_temp.safety_assert((select count(*)=0 from public.published_incidents where bar_id=(select venue from pg_temp.bevve_safety_check)),'invalid reviews create no public records');
      select * from public.review_incident_report((select request from pg_temp.bevve_safety_check),'approved','  Reviewed public summary  ');
      select * from public.review_incident_report((select request from pg_temp.bevve_safety_check),'approved','Reviewed public summary');
      select pg_temp.safety_assert((select count(*)=1 and bool_and(summary='Reviewed public summary' and verification_status='moderator_reviewed') from public.published_incidents where bar_id=(select venue from pg_temp.bevve_safety_check)),'identical review retries publish exactly one separate summary');
      select pg_temp.safety_assert((select status='approved' and reviewed_at>=created_at and description='Private synthetic description' from public.incident_reports where id=(select request from pg_temp.bevve_safety_check)),'private description is preserved after review');
      select pg_temp.safety_denied('select * from public.review_incident_report((select request from pg_temp.bevve_safety_check),''approved'',''Changed public summary'')','P0001');
      select pg_temp.safety_denied('select * from public.review_incident_report((select request from pg_temp.bevve_safety_check),''rejected'',null)','P0001');
      select * from public.review_incident_report((select reject_request from pg_temp.bevve_safety_check),'rejected',null);
      select * from public.review_incident_report((select reject_request from pg_temp.bevve_safety_check),'rejected',null);
      select pg_temp.safety_assert((select count(*)=1 from public.published_incidents where bar_id=(select venue from pg_temp.bevve_safety_check)),'rejection publishes nothing');
      select pg_temp.safety_assert((select count(*)=0 from pg_attribute where attrelid='public.published_incidents'::regclass and attname in ('report_id','reporter_id','description','reviewed_by') and not attisdropped),'public summary schema excludes private fields and identities');
      select pg_temp.safety_denied('select * from private.incident_publications','42501');
      select pg_temp.safety_assert((select count(*)=0 from public.bar_comparisons),'incident reports and reviews create no ranking votes');

      select set_config('request.jwt.claims',jsonb_build_object('sub',a)::text,true) from pg_temp.bevve_safety_check;
      select * from public.submit_incident_report((select request from pg_temp.bevve_safety_check),(select venue from pg_temp.bevve_safety_check),'Theft','Private synthetic description',now()-interval '1 day');
      select pg_temp.safety_assert((select count(*)=1 and bool_and(status='approved') from public.incident_reports),'owner can restore status and replay after moderation');
      select pg_temp.safety_assert((select count(*)=1 from public.published_incidents where bar_id=(select venue from pg_temp.bevve_safety_check)),'ordinary accounts can read only the reviewed public summary');
      select set_config('request.jwt.claims','{}',true);
      select pg_temp.safety_denied('select * from public.submit_incident_report(gen_random_uuid(),(select venue from pg_temp.bevve_safety_check),''Other'',''Private fixture'')','42501');
      select pg_temp.safety_denied('select * from public.review_incident_report((select request from pg_temp.bevve_safety_check),''approved'',''Reviewed public summary'')','42501');
      set local role anon;
      select pg_temp.safety_denied('select * from public.incident_reports','42501');
      select pg_temp.safety_denied('select * from public.published_incidents','42501');
      select pg_temp.safety_denied('select public.can_moderate_incidents()','42501');
      select pg_temp.safety_denied('select * from public.submit_incident_report(gen_random_uuid(),(select venue from pg_temp.bevve_safety_check),''Other'',''Private fixture'')','42501');
      select pg_temp.safety_denied('select * from public.review_incident_report((select request from pg_temp.bevve_safety_check),''approved'',''Reviewed public summary'')','42501');
      reset role;
    $batch$;
    raise exception using errcode='BV006',message='Checks complete';
  exception when sqlstate 'BV006' then null;
  end;
end
$checks$;
select 'Account safety checks passed. All test data was rolled back.' as result;
