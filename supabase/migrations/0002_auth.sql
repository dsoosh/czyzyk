-- Family-only sign up: the "Before User Created" auth hook rejects every email that
-- is not on allowed_emails, and a trigger creates the profile for accepted users.

create function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
  v_provider text := event -> 'user' -> 'app_metadata' ->> 'provider';
begin
  if v_provider is not null and v_provider <> 'google' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Logowanie jest możliwe tylko przez Google.'
    ));
  end if;

  if v_email = '' or not exists (select 1 from public.allowed_emails where email = v_email) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Brak dostępu – ten adres nie jest na liście rodziny.'
    ));
  end if;

  return '{}'::jsonb;
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- Creates (or recreates) the profile of an auth user whose email is allowed.
create function public.sync_profile(p_user_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  select u.id,
         a.email,
         coalesce(
           nullif(u.raw_user_meta_data ->> 'full_name', ''),
           nullif(u.raw_user_meta_data ->> 'name', ''),
           split_part(a.email, '@', 1)
         ),
         a.role
  from auth.users u
  join public.allowed_emails a on a.email = lower(btrim(u.email))
  where u.id = p_user_id
  on conflict (id) do update set role = excluded.role;
end;
$$;

revoke execute on function public.sync_profile(uuid) from public, anon, authenticated;

create function public.on_auth_user_created() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.sync_profile(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.on_auth_user_created();

-- Re-adding an email restores the profile of an existing account; changing the role
-- on the list changes it on the profile.
create function public.on_allowed_email_changed() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if tg_op = 'UPDATE' then
    update public.profiles set role = new.role where email = new.email;
    return new;
  end if;

  for v_user_id in select id from auth.users where lower(btrim(email)) = new.email loop
    perform public.sync_profile(v_user_id);
  end loop;
  return new;
end;
$$;

create trigger on_allowed_email_inserted
  after insert on public.allowed_emails
  for each row execute function public.on_allowed_email_changed();

create trigger on_allowed_email_role_updated
  after update of role on public.allowed_emails
  for each row execute function public.on_allowed_email_changed();

revoke execute on function public.on_auth_user_created() from public, anon, authenticated;
revoke execute on function public.on_allowed_email_changed() from public, anon, authenticated;
