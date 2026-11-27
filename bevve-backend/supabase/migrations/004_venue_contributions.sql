-- Apply once after 003. Existing records and table grants remain intact.
-- Append-only writes use a client request UUID for safe retries. Identity and
-- timestamps come from the server, and conflicting UUID reuse cannot edit data.
create function public.submit_crowd_report(p_request_id uuid, p_bar_id uuid, p_level integer)
returns setof public.crowd_reports
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); saved public.crowd_reports;
begin
  if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_request_id is null or p_bar_id is null or p_level is null or p_level not between 1 and 5 then
    raise exception 'Invalid crowd report' using errcode='22023';
  end if;
  insert into public.crowd_reports(id,bar_id,user_id,level) values(p_request_id,p_bar_id,caller,p_level)
    on conflict(id) do nothing;
  select * into saved from public.crowd_reports where id=p_request_id;
  if saved.user_id is distinct from caller or saved.bar_id is distinct from p_bar_id or saved.level is distinct from p_level then
    raise exception 'Conflicting crowd request' using errcode='22023';
  end if;
  return next saved;
end;
$$;

create function public.submit_drink_price(p_request_id uuid, p_bar_id uuid, p_drink_id uuid, p_price_cents integer)
returns setof public.drink_prices
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); saved public.drink_prices;
begin
  if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_request_id is null or p_bar_id is null or p_drink_id is null or p_price_cents is null or p_price_cents not between 50 and 10000 then
    raise exception 'Choose a catalog drink and a EUR price from 50 to 10000 cents' using errcode='22023';
  end if;
  insert into public.drink_prices(id,bar_id,drink_id,price_cents,currency,submitted_by)
    values(p_request_id,p_bar_id,p_drink_id,p_price_cents,'EUR',caller) on conflict(id) do nothing;
  select * into saved from public.drink_prices where id=p_request_id;
  if saved.submitted_by is distinct from caller or saved.bar_id is distinct from p_bar_id or saved.drink_id is distinct from p_drink_id
    or saved.price_cents is distinct from p_price_cents or saved.currency <> 'EUR' then
    raise exception 'Conflicting price request' using errcode='22023';
  end if;
  return next saved;
end;
$$;

-- Expose only the caller's EUR observations. Raw table reads remain denied.
create function public.get_my_drink_prices(p_offset integer default 0)
returns setof public.drink_prices
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_offset is null or p_offset < 0 then raise exception 'Invalid offset' using errcode='22023'; end if;
  return query select * from public.drink_prices where submitted_by=auth.uid() and currency='EUR'
    order by observed_at,id limit 500 offset p_offset;
end;
$$;
revoke all on function public.submit_crowd_report(uuid,uuid,integer),
  public.submit_drink_price(uuid,uuid,uuid,integer),public.get_my_drink_prices(integer) from public,anon;
grant execute on function public.submit_crowd_report(uuid,uuid,integer),
  public.submit_drink_price(uuid,uuid,uuid,integer),public.get_my_drink_prices(integer) to authenticated;
