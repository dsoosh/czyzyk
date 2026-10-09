-- Deleting an event (event-deletion): an admin removes a wrong or duplicate event for good.
-- Its history goes with it; things to bring keep existing without the event (on delete set null).

create function public.admin_delete_event(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  delete from public.events where id = p_id;
  if not found then
    raise exception 'Nie ma takiego wydarzenia.' using errcode = 'P0002';
  end if;
  delete from public.item_changes where item_type = 'event' and item_id = p_id;
end;
$$;

revoke execute on function public.admin_delete_event(uuid) from public, anon;
grant execute on function public.admin_delete_event(uuid) to authenticated;
