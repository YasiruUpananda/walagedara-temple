-- Preserve the queue and notices when the service is temporarily unavailable.
alter table public.display_state
  add column service_paused boolean not null default false;

create function public.set_service_paused(p_paused boolean)
returns public.display_state
language plpgsql security definer set search_path = '' as $$
declare result public.display_state;
begin
  perform private.require_admin_lock();
  if p_paused is null then
    raise exception 'Service status is required' using errcode = '22023';
  end if;
  update public.display_state
  set service_paused = p_paused, revision = revision + 1,
      updated_at = clock_timestamp()
  where id = 1 returning * into result;
  return result;
end;
$$;
revoke all on function public.set_service_paused(boolean) from public, anon, authenticated;
grant execute on function public.set_service_paused(boolean) to authenticated;
