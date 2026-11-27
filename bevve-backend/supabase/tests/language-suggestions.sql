-- Run the entire file as postgres after 005. Success and failure roll back fixtures.
do $checks$
begin
  begin
    execute $batch$
      create temporary table bevve_language_check on commit drop as select
        gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() moderator,gen_random_uuid() venue,
        gen_random_uuid() request,gen_random_uuid() alias_request,gen_random_uuid() reject_request;
      grant select on pg_temp.bevve_language_check to authenticated,anon;
      create function pg_temp.language_assert(ok boolean,label text) returns void language plpgsql as $$
      begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end;
      $$;
      create function pg_temp.language_denied(statement text,expected text) returns void language plpgsql as $$
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
      grant execute on function pg_temp.language_assert(boolean,text),pg_temp.language_denied(text,text) to authenticated,anon;
      insert into auth.users(id,email,raw_user_meta_data)
        select a,'language-a-'||a||'@example.invalid','{"username":"Language A"}'::jsonb from pg_temp.bevve_language_check
        union all select b,'language-b-'||b||'@example.invalid','{"username":"Language B"}'::jsonb from pg_temp.bevve_language_check
        union all select moderator,'language-m-'||moderator||'@example.invalid','{"username":"Language Moderator"}'::jsonb from pg_temp.bevve_language_check;
      insert into private.moderators select moderator from pg_temp.bevve_language_check;
      insert into public.bars(id,name,address,latitude,longitude,is_demo)
        select venue,'Language test','Test address',0,0,true from pg_temp.bevve_language_check;
      set local role authenticated;
      select set_config('request.jwt.claims',jsonb_build_object('sub',a)::text,true) from pg_temp.bevve_language_check;
      select pg_temp.language_assert(not public.can_moderate_languages(),'ordinary account has no moderation role');
      select pg_temp.language_denied('select * from public.submit_language_suggestion(null,(select venue from pg_temp.bevve_language_check),''it'')','P0001');
      select pg_temp.language_denied('select * from public.submit_language_suggestion(gen_random_uuid(),(select venue from pg_temp.bevve_language_check),''xx'')','P0001');
      select pg_temp.language_denied('select * from public.submit_language_suggestion(gen_random_uuid(),gen_random_uuid(),''it'')','23503');
      select * from public.submit_language_suggestion((select request from pg_temp.bevve_language_check),(select venue from pg_temp.bevve_language_check),'it');
      select * from public.submit_language_suggestion((select request from pg_temp.bevve_language_check),(select venue from pg_temp.bevve_language_check),'it');
      select * from public.submit_language_suggestion((select alias_request from pg_temp.bevve_language_check),(select venue from pg_temp.bevve_language_check),'it');
      select pg_temp.language_assert((select count(*)=1 and bool_and(status='pending' and reviewed_at is null and user_id=(select a from pg_temp.bevve_language_check)) from public.language_suggestions),'retries and simultaneous identical pending suggestions keep one owner-bound row');
      select pg_temp.language_assert((select count(*)=0 from public.bar_languages where bar_id=(select venue from pg_temp.bevve_language_check)),'pending suggestions are absent from approved venue languages');
      select pg_temp.language_denied('select * from public.submit_language_suggestion((select request from pg_temp.bevve_language_check),(select venue from pg_temp.bevve_language_check),''fr'')','22023');
      select pg_temp.language_denied('insert into public.language_suggestions(id,user_id,bar_id,language_code) select gen_random_uuid(),a,venue,''fr'' from pg_temp.bevve_language_check','42501');
      select pg_temp.language_denied('update public.language_suggestions set status=''approved''','42501');
      select pg_temp.language_denied('delete from public.language_suggestions','42501');
      select pg_temp.language_denied('insert into public.bar_languages(bar_id,language_code) select venue,''fr'' from pg_temp.bevve_language_check','42501');
      select pg_temp.language_denied('select * from private.language_suggestion_requests','42501');
      select pg_temp.language_denied('insert into private.moderators(user_id) select b from pg_temp.bevve_language_check','42501');
      select pg_temp.language_denied('select * from public.submit_language_suggestion((select alias_request from pg_temp.bevve_language_check),(select venue from pg_temp.bevve_language_check),''fr'')','22023');
      select pg_temp.language_denied('select * from public.moderate_language_suggestion((select request from pg_temp.bevve_language_check),''approved'')','42501');
      select set_config('request.jwt.claims',jsonb_build_object('sub',b)::text,true) from pg_temp.bevve_language_check;
      select pg_temp.language_assert((select count(*)=0 from public.language_suggestions),'suggestion history is private to its owner');
      select pg_temp.language_denied('select * from public.submit_language_suggestion((select request from pg_temp.bevve_language_check),(select venue from pg_temp.bevve_language_check),''it'')','22023');
      select * from public.submit_language_suggestion((select reject_request from pg_temp.bevve_language_check),(select venue from pg_temp.bevve_language_check),'fr');

      select set_config('request.jwt.claims',jsonb_build_object('sub',moderator)::text,true) from pg_temp.bevve_language_check;
      select pg_temp.language_assert(public.can_moderate_languages(),'registered moderator has review access');
      select pg_temp.language_assert((select count(*)=2 from public.language_suggestions where status='pending'),'moderator can read the pending queue');
      select pg_temp.language_assert((select count(*)=0 from public.language_suggestions where user_id=auth.uid()),'moderator own-history query excludes queue submissions');
      select pg_temp.language_denied('select * from public.moderate_language_suggestion((select request from pg_temp.bevve_language_check),''pending'')','P0001');
      select * from public.moderate_language_suggestion((select request from pg_temp.bevve_language_check),'approved');
      select * from public.moderate_language_suggestion((select request from pg_temp.bevve_language_check),'approved');
      select pg_temp.language_assert((select count(*)=1 and bool_and(language_code='it' and evidence_type='community') from public.bar_languages where bar_id=(select venue from pg_temp.bevve_language_check)),'approval publishes the language exactly once');
      select pg_temp.language_assert((select status='approved' and reviewed_at is not null from public.language_suggestions where id=(select request from pg_temp.bevve_language_check)),'owner history retains approval status');
      select pg_temp.language_denied('select * from public.moderate_language_suggestion((select request from pg_temp.bevve_language_check),''rejected'')','P0001');
      select * from public.moderate_language_suggestion((select reject_request from pg_temp.bevve_language_check),'rejected');
      select * from public.moderate_language_suggestion((select reject_request from pg_temp.bevve_language_check),'rejected');
      select pg_temp.language_assert((select count(*)=0 from public.bar_languages where bar_id=(select venue from pg_temp.bevve_language_check) and language_code='fr'),'rejection does not publish');
      select pg_temp.language_assert((select jsonb_array_length(venue->'languages')=1 from public.get_venue_catalog() where venue->>'id'=(select venue::text from pg_temp.bevve_language_check)),'catalog exposes only approved languages');

      select set_config('request.jwt.claims',jsonb_build_object('sub',a)::text,true) from pg_temp.bevve_language_check;
      select * from public.submit_language_suggestion((select alias_request from pg_temp.bevve_language_check),(select venue from pg_temp.bevve_language_check),'it');
      select pg_temp.language_assert((select count(*)=1 and bool_and(status='approved') from public.language_suggestions),'retrying an alias after review returns the existing reviewed row');
      select pg_temp.language_assert((select preferred_language='en' from public.profiles where id=auth.uid()),'suggesting Italian does not change interface preferences');
      select pg_temp.language_assert((select count(*)=0 from public.bar_comparisons),'language suggestions create no ranking votes');
      select set_config('request.jwt.claims',jsonb_build_object('sub',b)::text,true) from pg_temp.bevve_language_check;
      select * from public.submit_language_suggestion(gen_random_uuid(),(select venue from pg_temp.bevve_language_check),'fr');
      select pg_temp.language_assert((select count(*)=2 from public.language_suggestions),'a rejected suggestion remains in history when a new request is made');
      select set_config('request.jwt.claims','{}',true);
      select pg_temp.language_denied('select * from public.submit_language_suggestion(gen_random_uuid(),(select venue from pg_temp.bevve_language_check),''it'')','42501');
      select pg_temp.language_denied('select * from public.moderate_language_suggestion((select request from pg_temp.bevve_language_check),''approved'')','42501');
      set local role anon;
      select pg_temp.language_denied('select id from public.language_suggestions','42501');
      select pg_temp.language_denied('select public.can_moderate_languages()','42501');
      select pg_temp.language_denied('select * from public.submit_language_suggestion(gen_random_uuid(),(select venue from pg_temp.bevve_language_check),''it'')','42501');
      select pg_temp.language_denied('select * from public.moderate_language_suggestion((select request from pg_temp.bevve_language_check),''approved'')','42501');
      reset role;
    $batch$;
    raise exception using errcode='BV005',message='Checks complete';
  exception when sqlstate 'BV005' then null;
  end;
end
$checks$;
select 'Language suggestion checks passed. All test data was rolled back.' as result;
