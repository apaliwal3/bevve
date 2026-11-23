begin;

create table public.language_suggestions (
 id uuid primary key,
 user_id uuid not null references public.profiles on delete cascade,
 bar_id uuid not null references public.bars,
 language_code text not null check(language_code in ('en','it','es','fr','de','pt','ar','ja')),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references public.profiles on delete set null,
 check ((status = 'pending' and reviewed_at is null and reviewed_by is null) or
        (status <> 'pending' and reviewed_at is not null))
);
create unique index language_suggestions_pending on public.language_suggestions(user_id,bar_id,language_code) where status = 'pending';
create index on public.language_suggestions(user_id,created_at,id);
create index on public.language_suggestions(created_at,id) where status = 'pending';
alter table public.language_suggestions enable row level security;
revoke all on public.language_suggestions from public, anon, authenticated;
grant select(id,user_id,bar_id,language_code,status,created_at,reviewed_at) on public.language_suggestions to authenticated;
create policy language_suggestions_read on public.language_suggestions for select to authenticated
 using(user_id = (select auth.uid()) or (select private.is_moderator()));

-- Preserve every accepted request ID, including coalesced requests from another device.
create table private.language_suggestion_requests (
 request_id uuid primary key,
 suggestion_id uuid not null references public.language_suggestions on delete cascade
);
revoke all on private.language_suggestion_requests from public,anon,authenticated;

create function public.can_moderate_languages() returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and private.is_moderator();
$$;

create function public.submit_language_suggestion(p_request_id uuid,p_bar_id uuid,p_language_code text)
returns public.language_suggestions language plpgsql security definer set search_path = '' as $$
declare saved public.language_suggestions; owner_id uuid := auth.uid();
begin
 if owner_id is null then raise exception 'Sign in first' using errcode = '42501'; end if;
 if p_request_id is null or p_bar_id is null or p_language_code is null or
    p_language_code not in ('en','it','es','fr','de','pt','ar','ja') then raise exception 'Invalid language suggestion'; end if;
 -- Serialize a request ID across accounts and payloads before checking replay.
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select s.* into saved from public.language_suggestions s
 join private.language_suggestion_requests r on r.suggestion_id = s.id where r.request_id = p_request_id;
 if found then
   if saved.user_id <> owner_id or saved.bar_id <> p_bar_id or saved.language_code <> p_language_code then
     raise exception 'Request ID already used' using errcode = '22023';
   end if;
   return saved;
 end if;
 -- Different devices may submit the same pending suggestion concurrently.
 insert into public.language_suggestions(id,user_id,bar_id,language_code)
 values(p_request_id,owner_id,p_bar_id,p_language_code)
 on conflict (user_id,bar_id,language_code) where status = 'pending' do nothing returning * into saved;
 if not found then
   select * into saved from public.language_suggestions
    where user_id = owner_id and bar_id = p_bar_id and language_code = p_language_code and status = 'pending';
 end if;
 if saved.id is null then raise exception 'Suggestion changed; refresh and retry'; end if;
 insert into private.language_suggestion_requests(request_id,suggestion_id) values(p_request_id,saved.id);
 return saved;
end;
$$;

create function public.moderate_language_suggestion(p_suggestion_id uuid,p_decision text)
returns public.language_suggestions language plpgsql security definer set search_path = '' as $$
declare saved public.language_suggestions;
begin
 if auth.uid() is null or not private.is_moderator() then raise exception 'Moderator access required' using errcode = '42501'; end if;
 if p_decision is null or p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
 select * into saved from public.language_suggestions where id = p_suggestion_id for update;
 if not found then raise exception 'Suggestion not found'; end if;
 -- Repeating the same decision after a lost response has no additional effect.
 if saved.status = p_decision then return saved; end if;
 if saved.status <> 'pending' then raise exception 'Suggestion already reviewed'; end if;
 if p_decision = 'approved' then
   insert into public.bar_languages(bar_id,language_code,evidence_type)
    values(saved.bar_id,saved.language_code,'community') on conflict (bar_id,language_code) do nothing;
 end if;
 update public.language_suggestions set status = p_decision,reviewed_at = now(),reviewed_by = auth.uid()
  where id = p_suggestion_id returning * into saved;
 return saved;
end;
$$;
revoke all on function public.can_moderate_languages(),public.submit_language_suggestion(uuid,uuid,text),
 public.moderate_language_suggestion(uuid,text) from public,anon,authenticated;
grant execute on function public.can_moderate_languages(),public.submit_language_suggestion(uuid,uuid,text),
 public.moderate_language_suggestion(uuid,text) to authenticated;
commit;
