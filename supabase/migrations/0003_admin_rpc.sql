-- Admin-only operations on the family allow list. Every function checks the
-- caller's role in the database (data-access-control) and protects the caller
-- from removing or demoting themselves (family-access).

create function public.assert_admin() returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Brak uprawnień administratora.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.assert_admin() from public, anon, authenticated;

create function public.admin_upsert_allowed_email(p_email text, p_role text)
returns public.allowed_emails
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_self text;
  v_row public.allowed_emails;
begin
  perform public.assert_admin();

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Niepoprawny adres e-mail.' using errcode = '22023';
  end if;
  if p_role is null or p_role not in ('admin', 'family') then
    raise exception 'Niepoprawna rola.' using errcode = '22023';
  end if;

  select email into v_self from public.profiles where id = auth.uid();
  if v_email = v_self and p_role <> 'admin' then
    raise exception 'Nie możesz odebrać sobie roli administratora.' using errcode = '22023';
  end if;

  insert into public.allowed_emails (email, role)
  values (v_email, p_role)
  on conflict (email) do update set role = excluded.role
  returning * into v_row;

  return v_row;
end;
$$;

create function public.admin_delete_allowed_email(p_email text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_self text;
begin
  perform public.assert_admin();

  select email into v_self from public.profiles where id = auth.uid();
  if v_email = v_self then
    raise exception 'Nie możesz usunąć własnego adresu.' using errcode = '22023';
  end if;

  delete from public.allowed_emails where email = v_email;
end;
$$;

revoke execute on function public.admin_upsert_allowed_email(text, text) from public, anon;
revoke execute on function public.admin_delete_allowed_email(text) from public, anon;
grant execute on function public.admin_upsert_allowed_email(text, text) to authenticated;
grant execute on function public.admin_delete_allowed_email(text) to authenticated;
