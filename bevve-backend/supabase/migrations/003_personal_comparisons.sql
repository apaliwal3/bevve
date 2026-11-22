-- Retry-safe explicit votes. Apply once after 002; existing history is preserved.
-- The client supplies only a request ID and the chosen pair. Ownership and time
-- are assigned here, and conflicting reuse of a request ID never changes a vote.
create function public.submit_personal_comparison(p_request_id uuid, p_winner_bar_id uuid, p_loser_bar_id uuid)
returns setof public.bar_comparisons
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  saved public.bar_comparisons;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_request_id is null or p_winner_bar_id is null or p_loser_bar_id is null
    or p_winner_bar_id = p_loser_bar_id then
    raise exception 'Choose two different venues and a request ID' using errcode = '22023';
  end if;

  select * into saved from public.bar_comparisons where id = p_request_id;
  if not found then
    if (select count(*) from public.venue_impressions
        where user_id = caller and bar_id in (p_winner_bar_id, p_loser_bar_id)) <> 2 then
      raise exception 'Save an impression for both venues first' using errcode = '42501';
    end if;
    insert into public.bar_comparisons(id,user_id,winner_bar_id,loser_bar_id)
      values (p_request_id,caller,p_winner_bar_id,p_loser_bar_id)
      on conflict(id) do nothing;
    -- Also handles two simultaneous retries of the same request.
    select * into saved from public.bar_comparisons where id = p_request_id;
  end if;
  if saved.user_id is distinct from caller or saved.winner_bar_id is distinct from p_winner_bar_id
    or saved.loser_bar_id is distinct from p_loser_bar_id then
    raise exception 'Comparison request conflicts with an existing vote' using errcode = '22023';
  end if;
  return next saved;
end;
$$;
revoke all on function public.submit_personal_comparison(uuid,uuid,uuid) from public,anon;
grant execute on function public.submit_personal_comparison(uuid,uuid,uuid) to authenticated;
