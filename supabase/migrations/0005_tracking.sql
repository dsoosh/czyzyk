-- Stage 3: marking items as done (item-tracking). Each RPC only sets "who" to
-- the caller and "when" to now(), or clears both; no other column is reachable.

create function public.mark_packed(p_id uuid, p_done boolean)
returns public.bring_items
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.bring_items;
begin
  if not public.is_family() then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  update public.bring_items
     set packed_by = case when p_done then auth.uid() end,
         packed_at = case when p_done then now() end
   where id = p_id and status <> 'cancelled'
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Nie ma takiej rzeczy.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

create function public.mark_paid(p_id uuid, p_done boolean)
returns public.payments
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.payments;
begin
  if not public.is_family() then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  update public.payments
     set paid_by = case when p_done then auth.uid() end,
         paid_at = case when p_done then now() end
   where id = p_id and status <> 'cancelled'
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Nie ma takiej płatności.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

create function public.mark_resolved(p_id uuid, p_done boolean)
returns public.action_required
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.action_required;
begin
  if not public.is_family() then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  update public.action_required
     set resolved_by = case when p_done then auth.uid() end,
         resolved_at = case when p_done then now() end
   where id = p_id and status <> 'cancelled'
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Nie ma takiej sprawy.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

revoke execute on function public.mark_packed(uuid, boolean) from public, anon;
revoke execute on function public.mark_paid(uuid, boolean) from public, anon;
revoke execute on function public.mark_resolved(uuid, boolean) from public, anon;
grant execute on function public.mark_packed(uuid, boolean) to authenticated;
grant execute on function public.mark_paid(uuid, boolean) to authenticated;
grant execute on function public.mark_resolved(uuid, boolean) to authenticated;
