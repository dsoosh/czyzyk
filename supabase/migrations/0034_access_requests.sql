-- Families joining (families-joining): signing in with an email outside the allow list records an
-- access request instead of being rejected. The operator is notified and approves it (a new family)
-- or rejects it; a family adds and removes its own members. An account without a profile still sees
-- nothing: every policy and RPC requires is_family().

create table public.access_requests (
  email text primary key check (email = lower(btrim(email))),
  user_id uuid references auth.users (id) on delete cascade,
  display_name text,
  status text not null default 'pending' check (status in ('pending', 'rejected')),
  requested_at timestamptz not null default now(),
  -- Set by the worker once the admins were notified, so each request is announced once.
  notified_at timestamptz
);

alter table public.access_requests enable row level security;
revoke all on public.access_requests from anon;
revoke insert, update, delete, truncate on public.access_requests from authenticated;
create policy admin_read on public.access_requests for select to authenticated using ((select public.is_admin()));

-- Any Google account may be created; the profile (and with it access) depends on the allow list.
create or replace function public.hook_before_user_created(event jsonb) returns jsonb
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
  if v_email = '' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Brak dostępu – konto Google bez adresu e-mail.'
    ));
  end if;
  return '{}'::jsonb;
end;
$$;

-- A new account outside the allow list leaves an access request.
create or replace function public.on_auth_user_created() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(new.email, '')));
begin
  perform public.sync_profile(new.id);
  if v_email <> '' and not exists (select 1 from public.allowed_emails where email = v_email) then
    insert into public.access_requests (email, user_id, display_name)
    values (
      v_email,
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''))
    )
    on conflict (email) do update set user_id = excluded.user_id, display_name = excluded.display_name;
  end if;
  return new;
end;
$$;

-- An email added to the list (by the operator or a family) no longer waits.
create function public.on_allowed_email_clears_request() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.access_requests where email = new.email;
  return new;
end;
$$;

create trigger allowed_email_clears_request after insert on public.allowed_emails
  for each row execute function public.on_allowed_email_clears_request();

revoke execute on function public.on_allowed_email_clears_request() from public, anon, authenticated;

-- The caller's own request: 'pending', 'rejected' or null (shown on the waiting screen).
create function public.my_access_request() returns text
language sql stable security definer
set search_path = ''
as $$
  select r.status from public.access_requests r where r.user_id = auth.uid()
$$;

create function public.admin_approve_access_request(p_email text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_request public.access_requests;
  v_family uuid;
begin
  perform public.assert_admin();
  select * into v_request from public.access_requests where email = lower(btrim(coalesce(p_email, '')));
  if not found then
    raise exception 'Nie ma takiej prośby.' using errcode = 'P0002';
  end if;
  insert into public.families (name)
  values (left('Rodzina ' || coalesce(nullif(btrim(v_request.display_name), ''), split_part(v_request.email, '@', 1)), 60))
  returning id into v_family;
  insert into public.allowed_emails (email, role, family_id) values (v_request.email, 'family', v_family);
end;
$$;

create function public.admin_reject_access_request(p_email text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  update public.access_requests set status = 'rejected' where email = lower(btrim(coalesce(p_email, '')));
  if not found then
    raise exception 'Nie ma takiej prośby.' using errcode = 'P0002';
  end if;
end;
$$;

-- Members of the caller's family: allowed emails with the profile once they signed in.
create function public.family_members()
returns table (email text, display_name text, role text, signed_in boolean, is_me boolean)
language sql stable security definer
set search_path = ''
as $$
  select a.email, p.display_name, a.role, p.id is not null, p.id = auth.uid()
    from public.allowed_emails a
    left join public.profiles p on p.email = a.email
   where public.is_family() and a.family_id = public.my_family()
   order by a.created_at, a.email
$$;

create function public.family_add_member(p_email text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_family uuid := public.my_family();
  v_existing uuid;
begin
  if not public.is_family() or v_family is null then
    raise exception 'Brak dostępu.' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Niepoprawny adres e-mail.' using errcode = '22023';
  end if;
  select family_id into v_existing from public.allowed_emails where email = v_email;
  if found then
    if v_existing = v_family then
      return;
    end if;
    raise exception 'Ten adres należy już do innej rodziny.' using errcode = '23505';
  end if;
  insert into public.allowed_emails (email, role, family_id) values (v_email, 'family', v_family);
end;
$$;

create function public.family_remove_member(p_email text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_family uuid := public.my_family();
  v_row public.allowed_emails;
begin
  if not public.is_family() or v_family is null then
    raise exception 'Brak dostępu.' using errcode = '42501';
  end if;
  select * into v_row from public.allowed_emails where email = v_email and family_id = v_family;
  if not found then
    raise exception 'Nie ma takiego członka rodziny.' using errcode = 'P0002';
  end if;
  if v_email = (select email from public.profiles where id = auth.uid()) then
    raise exception 'Nie możesz usunąć siebie.' using errcode = '22023';
  end if;
  if v_row.role = 'admin' then
    raise exception 'Nie możesz usunąć administratora.' using errcode = '22023';
  end if;
  delete from public.allowed_emails where email = v_email;
end;
$$;

revoke execute on function public.my_access_request() from public, anon;
revoke execute on function public.admin_approve_access_request(text) from public, anon;
revoke execute on function public.admin_reject_access_request(text) from public, anon;
revoke execute on function public.family_members() from public, anon;
revoke execute on function public.family_add_member(text) from public, anon;
revoke execute on function public.family_remove_member(text) from public, anon;
grant execute on function public.my_access_request() to authenticated;
grant execute on function public.admin_approve_access_request(text) to authenticated;
grant execute on function public.admin_reject_access_request(text) to authenticated;
grant execute on function public.family_members() to authenticated;
grant execute on function public.family_add_member(text) to authenticated;
grant execute on function public.family_remove_member(text) to authenticated;
