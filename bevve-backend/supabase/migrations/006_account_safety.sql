begin;

create index incident_history_order on public.incident_reports(reporter_id,created_at,id);
create index incident_pending_order on public.incident_reports(created_at,id) where status = 'pending';

create function public.can_moderate_incidents() returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and private.is_moderator();
$$;

create function public.submit_incident_report(p_request_id uuid,p_bar_id uuid,p_category text,p_description text,p_occurred_at timestamptz default null)
returns public.incident_reports language plpgsql security definer set search_path = '' as $$
declare saved public.incident_reports; owner_id uuid := auth.uid();
begin
 if owner_id is null then raise exception 'Sign in first' using errcode = '42501'; end if;
 if p_request_id is null or p_bar_id is null or p_category is null or p_category not in ('Theft','Harassment','Violence','Other') or
    p_description is null or length(trim(p_description)) not between 1 and 4000 or
    (p_occurred_at is not null and (not isfinite(p_occurred_at) or p_occurred_at > now())) then
   raise exception 'Invalid incident report' using errcode = '22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into saved from public.incident_reports where id = p_request_id;
 if found then
   if saved.reporter_id is distinct from owner_id or saved.bar_id <> p_bar_id or saved.category <> p_category or
      saved.description <> trim(p_description) or saved.occurred_at is distinct from p_occurred_at then
     raise exception 'Request ID already used' using errcode = '22023';
   end if;
   return saved;
 end if;
 insert into public.incident_reports(id,bar_id,reporter_id,category,description,occurred_at)
 values(p_request_id,p_bar_id,owner_id,p_category,trim(p_description),p_occurred_at) returning * into saved;
 return saved;
end;
$$;

-- New endpoint supports retries without changing the deployed legacy RPC's
-- one-decision behavior. Public summaries are always supplied separately.
create function public.review_incident_report(p_report_id uuid,p_decision text,p_summary text default null)
returns public.incident_reports language plpgsql security definer set search_path = '' as $$
declare saved public.incident_reports; summary_text text := nullif(trim(p_summary),''); published_summary text;
begin
 if auth.uid() is null or not private.is_moderator() then raise exception 'Moderator access required' using errcode = '42501'; end if;
 if p_decision is null or p_decision not in ('approved','rejected') or
    (p_decision = 'approved' and (summary_text is null or length(summary_text) > 1000)) or
    (p_decision = 'rejected' and p_summary is not null) then
   raise exception 'Invalid review or public summary' using errcode = '22023';
 end if;
 select * into saved from public.incident_reports where id = p_report_id for update;
 if not found then raise exception 'Report not found'; end if;
 if saved.status <> 'pending' then
   if saved.status <> p_decision then raise exception 'Report already reviewed'; end if;
   if p_decision = 'approved' then
     select p.summary into published_summary from private.incident_publications link
      join public.published_incidents p on p.id = link.publication_id where link.report_id = saved.id;
     if published_summary is distinct from summary_text then raise exception 'Report already reviewed with a different summary'; end if;
   end if;
   return saved;
 end if;
 -- Existing RPC performs the role check, private audit and atomic publication.
 perform public.moderate_incident(p_report_id,p_decision,summary_text);
 select * into saved from public.incident_reports where id = p_report_id;
 return saved;
end;
$$;
revoke all on function public.can_moderate_incidents(),public.submit_incident_report(uuid,uuid,text,text,timestamptz),
 public.review_incident_report(uuid,text,text) from public,anon,authenticated;
grant execute on function public.can_moderate_incidents(),public.submit_incident_report(uuid,uuid,text,text,timestamptz),
 public.review_incident_report(uuid,text,text) to authenticated;
commit;
