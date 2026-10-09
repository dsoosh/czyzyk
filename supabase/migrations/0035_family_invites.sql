-- Family invites (families-joining): a family adding an email that belongs to another family invites
-- it instead of failing. The invitee accepts (moves to the inviting family, merging their old family
-- when they were its only member) or declines.

create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email))),
  family_id uuid not null references public.families (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Set by the worker once the invitee was notified, so each invite is announced once.
  notified_at timestamptz,
  unique (email, family_id)
);

alter table public.family_invites enable row level security;
revoke all on public.family_invites from anon;
revoke insert, update, delete, truncate on public.family_invites from authenticated;
-- Reads go through the RPCs below; the operator may look at the table.
create policy admin_read on public.family_invites for select to authenticated using ((select public.is_admin()));

-- 'added' (new email, joins right away), 'invited' (email of another family) or 'exists'.
drop function public.family_add_member(text);
create function public.family_add_member(p_email text) returns text
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
      return 'exists';
    end if;
    insert into public.family_invites (email, family_id, invited_by)
    values (v_email, v_family, auth.uid())
    on conflict (email, family_id) do nothing;
    return 'invited';
  end if;
  insert into public.allowed_emails (email, role, family_id) values (v_email, 'family', v_family);
  return 'added';
end;
$$;

-- Members and invites sent by the caller's family.
drop function public.family_members();
create function public.family_members()
returns table (email text, display_name text, role text, signed_in boolean, is_me boolean, invited boolean)
language sql stable security definer
set search_path = ''
as $$
  select email, display_name, role, signed_in, is_me, invited from (
    select a.email, p.display_name, a.role, p.id is not null as signed_in, coalesce(p.id = auth.uid(), false) as is_me,
           false as invited, a.created_at
      from public.allowed_emails a
      left join public.profiles p on p.email = a.email
     where public.is_family() and a.family_id = public.my_family()
    union all
    select i.email, p.display_name, 'family', p.id is not null, false, true, i.created_at
      from public.family_invites i
      left join public.profiles p on p.email = i.email
     where public.is_family() and i.family_id = public.my_family()
  ) m
  order by invited, created_at, email
$$;

-- Removing a member, or cancelling an invite the family sent.
create or replace function public.family_remove_member(p_email text) returns void
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
  delete from public.family_invites where email = v_email and family_id = v_family;
  if found then
    return;
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

-- Invites for the caller's email.
create function public.my_family_invites()
returns table (id uuid, family_name text, invited_by_name text, created_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select i.id, f.name,
         coalesce(nullif(btrim(p.display_name), ''), split_part(p.email, '@', 1)),
         i.created_at
    from public.family_invites i
    join public.families f on f.id = i.family_id
    left join public.profiles p on p.id = i.invited_by
   where public.is_family()
     and i.email = (select email from public.profiles where id = auth.uid())
   order by i.created_at
$$;

create function public.accept_family_invite(p_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text := (select email from public.profiles where id = auth.uid());
  v_old uuid := public.my_family();
  v_new uuid;
  v_alone boolean;
begin
  if not public.is_family() or v_old is null then
    raise exception 'Brak dostępu.' using errcode = '42501';
  end if;
  select family_id into v_new from public.family_invites where id = p_id and email = v_email;
  if not found then
    raise exception 'Nie ma takiego zaproszenia.' using errcode = 'P0002';
  end if;
  delete from public.family_invites where email = v_email;
  if v_new = v_old then
    return;
  end if;

  v_alone := not exists (select 1 from public.allowed_emails where family_id = v_old and email <> v_email);
  -- The profile follows the allow list (on_allowed_email_changed).
  update public.allowed_emails set family_id = v_new where email = v_email;

  if v_alone then
    -- The new family already has a child of that name: keep theirs.
    delete from public.children o
     where o.family_id = v_old
       and exists (select 1 from public.children n where n.family_id = v_new and lower(btrim(n.name)) = lower(btrim(o.name)));
    update public.children o set color = null
     where o.family_id = v_old
       and exists (select 1 from public.children n where n.family_id = v_new and n.color = o.color);
    update public.children set family_id = v_new where family_id = v_old;
    insert into public.item_done (item_type, item_id, family_id, done_by, done_at, resolution)
    select item_type, item_id, v_new, done_by, done_at, resolution from public.item_done where family_id = v_old
    on conflict do nothing;
    update public.events set family_id = v_new where family_id = v_old;
    update public.bring_items set family_id = v_new where family_id = v_old;
    update public.payments set family_id = v_new where family_id = v_old;
    delete from public.families where id = v_old;
    perform public.refresh_item_children();
  end if;
end;
$$;

create function public.decline_family_invite(p_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.family_invites
   where id = p_id and email = (select email from public.profiles where id = auth.uid());
  if not found then
    raise exception 'Nie ma takiego zaproszenia.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.family_add_member(text) from public, anon;
revoke execute on function public.family_members() from public, anon;
revoke execute on function public.my_family_invites() from public, anon;
revoke execute on function public.accept_family_invite(uuid) from public, anon;
revoke execute on function public.decline_family_invite(uuid) from public, anon;
grant execute on function public.family_add_member(text) to authenticated;
grant execute on function public.family_members() to authenticated;
grant execute on function public.my_family_invites() to authenticated;
grant execute on function public.accept_family_invite(uuid) to authenticated;
grant execute on function public.decline_family_invite(uuid) to authenticated;
