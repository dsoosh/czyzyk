-- Roles of message authors (contact-roles): which numbers or names belong to a teacher
-- ("ciocia"), the management, another parent or our own family. Keys are normalised by
-- normalizeAuthor() in @czyzyk/shared ("+48535111213" or a lowercased name).

create table public.contact_roles (
  author_key text primary key check (char_length(author_key) between 1 and 100),
  role text not null check (role in ('ciocia', 'dyrekcja', 'rodzic', 'rodzina')),
  label text check (label is null or char_length(label) between 1 and 60),
  -- Set when a family member marked the number as their own (Settings → Mój numer).
  profile_id uuid references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now()
);
create unique index contact_roles_profile_key on public.contact_roles (profile_id) where profile_id is not null;

alter table public.contact_roles enable row level security;
create policy family_read on public.contact_roles for select to authenticated using ((select public.is_family()));
revoke all on public.contact_roles from anon;
revoke insert, update, delete, truncate on public.contact_roles from authenticated;

-- Authors seen in tracked groups, most recently active first (runs with the caller's RLS).
create function public.list_message_authors()
returns table (author text, messages bigint, last_at timestamptz)
language sql stable
set search_path = ''
as $$
  select m.author, count(*), max(m.sent_at)
    from public.messages m
    join public.wa_groups g on g.id = m.group_id and g.tracked
   group by m.author
   order by max(m.sent_at) desc
   limit 1000;
$$;

-- Admin: sets an author's role and label; p_role null removes the mapping.
create function public.admin_save_contact_role(p_key text, p_role text, p_label text)
returns public.contact_roles
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.contact_roles;
begin
  perform public.assert_admin();
  if p_role is null then
    delete from public.contact_roles where author_key = p_key;
    return null;
  end if;
  insert into public.contact_roles (author_key, role, label, profile_id, updated_at)
    values (p_key, p_role, nullif(btrim(p_label), ''), null, now())
  on conflict (author_key) do update
    set role = excluded.role, label = excluded.label, updated_at = now(),
        -- A family member's own number stays theirs only while it is marked as family.
        profile_id = case when excluded.role = 'rodzina' then public.contact_roles.profile_id end
  returning * into v_row;
  return v_row;
end;
$$;

-- Any family member: marks their own WhatsApp number (p_key "+48…"), or clears it (null).
create function public.set_my_phone(p_key text)
returns public.contact_roles
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.contact_roles;
  v_name text;
begin
  if not public.is_family() then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  if p_key is not null and p_key !~ '^\+[0-9]{10,15}$' then
    raise exception 'To nie jest numer telefonu.' using errcode = '22023';
  end if;
  delete from public.contact_roles where profile_id = auth.uid();
  if p_key is null then
    return null;
  end if;
  select coalesce(nullif(split_part(btrim(display_name), ' ', 1), ''), split_part(email, '@', 1)) into v_name
    from public.profiles where id = auth.uid();
  insert into public.contact_roles (author_key, role, label, profile_id, updated_at)
    values (p_key, 'rodzina', left(v_name, 60), auth.uid(), now())
  on conflict (author_key) do update
    set role = 'rodzina', label = excluded.label, profile_id = excluded.profile_id, updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.list_message_authors() from public, anon;
revoke execute on function public.admin_save_contact_role(text, text, text) from public, anon;
revoke execute on function public.set_my_phone(text) from public, anon;
grant execute on function public.list_message_authors() to authenticated;
grant execute on function public.admin_save_contact_role(text, text, text) to authenticated;
grant execute on function public.set_my_phone(text) to authenticated;
