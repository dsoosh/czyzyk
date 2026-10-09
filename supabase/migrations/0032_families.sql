-- Families (families): many families in one app. A family sees the groups its children attend
-- and the groups the operator marks as shared; children, profiles and "done" marks belong to
-- one family. The operator (admin) still sees everything. Existing data goes to one family.

-- ---------------------------------------------------------------------------
-- Families and membership
-- ---------------------------------------------------------------------------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

alter table public.families enable row level security;
revoke all on public.families from anon;
revoke insert, update, delete, truncate on public.families from authenticated;

-- The first family, created when needed: where an email without a family goes (until families
-- join on their own, families-joining).
create function public.default_family() returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.families order by created_at, id limit 1;
  if v_id is null then
    insert into public.families (name) values ('Rodzina') returning id into v_id;
  end if;
  return v_id;
end;
$$;

alter table public.allowed_emails add column family_id uuid references public.families (id) on delete cascade;
alter table public.profiles add column family_id uuid references public.families (id) on delete cascade;
alter table public.children add column family_id uuid references public.families (id) on delete cascade;

update public.allowed_emails set family_id = public.default_family();
update public.profiles p set family_id = a.family_id from public.allowed_emails a where a.email = p.email;
update public.children set family_id = public.default_family();

alter table public.allowed_emails alter column family_id set not null;
alter table public.profiles alter column family_id set not null;
alter table public.children alter column family_id set not null;
-- Server-side inserts (and tests) without a family use the first one.
alter table public.children alter column family_id set default public.default_family();

create function public.allowed_email_family() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  new.family_id := coalesce(new.family_id, public.default_family());
  return new;
end;
$$;

create trigger allowed_email_family before insert on public.allowed_emails
  for each row execute function public.allowed_email_family();

-- The profile follows its email's role and family.
create or replace function public.sync_profile(p_user_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, role, family_id)
  select u.id,
         a.email,
         coalesce(
           nullif(u.raw_user_meta_data ->> 'full_name', ''),
           nullif(u.raw_user_meta_data ->> 'name', ''),
           split_part(a.email, '@', 1)
         ),
         a.role,
         a.family_id
  from auth.users u
  join public.allowed_emails a on a.email = lower(btrim(u.email))
  where u.id = p_user_id
  on conflict (id) do update set role = excluded.role, family_id = excluded.family_id;
end;
$$;

create or replace function public.on_allowed_email_changed() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if tg_op = 'UPDATE' then
    update public.profiles set role = new.role, family_id = new.family_id where email = new.email;
    return new;
  end if;

  for v_user_id in select id from auth.users where lower(btrim(email)) = new.email loop
    perform public.sync_profile(v_user_id);
  end loop;
  return new;
end;
$$;

drop trigger on_allowed_email_role_updated on public.allowed_emails;
create trigger on_allowed_email_role_updated
  after update of role, family_id on public.allowed_emails
  for each row execute function public.on_allowed_email_changed();

-- ---------------------------------------------------------------------------
-- Shared groups and visibility helpers
-- ---------------------------------------------------------------------------

alter table public.wa_groups add column shared boolean not null default false;
-- Nothing changes for the existing family: a tracked group no child attends stays visible to it.
update public.wa_groups g set shared = true
 where g.tracked and not exists (select 1 from public.children c where c.group_id = g.id);

create function public.my_family() returns uuid
language sql stable security definer
set search_path = ''
as $$
  select family_id from public.profiles where id = auth.uid()
$$;

-- Also used by the server (digests, alerts, calendar feed, assistant) for one family.
create function public.family_sees_group(p_family uuid, p_group uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_group is null
      or exists (select 1 from public.wa_groups g where g.id = p_group and g.shared)
      or exists (select 1 from public.children c where c.family_id = p_family and c.group_id = p_group)
$$;

-- The caller sees the group (null: the whole kindergarten): the operator always, a family when
-- the group is shared or one of its children attends it.
create function public.visible_group(p_group uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin() or (public.is_family() and public.family_sees_group(public.my_family(), p_group))
$$;

-- An item the caller sees: its group, and – for items created from a family's own action –
-- only that family.
create function public.item_visible(p_type text, p_id uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_group uuid;
  v_family uuid;
  v_found boolean := false;
begin
  case p_type
    when 'event' then select group_id, family_id, true into v_group, v_family, v_found from public.events where id = p_id;
    when 'bring_item' then select group_id, family_id, true into v_group, v_family, v_found from public.bring_items where id = p_id;
    when 'payment' then select group_id, family_id, true into v_group, v_family, v_found from public.payments where id = p_id;
    when 'action_required' then select group_id, null, true into v_group, v_family, v_found from public.action_required where id = p_id;
    when 'closure' then select group_id, null, true into v_group, v_family, v_found from public.closures where id = p_id;
    when 'fact' then select group_id, null, true into v_group, v_family, v_found from public.facts where id = p_id;
    else return false;
  end case;
  if not coalesce(v_found, false) then
    return false;
  end if;
  return public.visible_group(v_group) and (v_family is null or v_family = public.my_family() or public.is_admin());
end;
$$;

-- Items created from a family's choice on a "wymaga odpowiedzi" item belong to that family only.
alter table public.events add column family_id uuid references public.families (id) on delete cascade;
alter table public.bring_items add column family_id uuid references public.families (id) on delete cascade;
alter table public.payments add column family_id uuid references public.families (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Row level security by family
-- ---------------------------------------------------------------------------

drop policy family_read on public.profiles;
drop policy family_read on public.wa_groups;
drop policy family_read on public.messages;
drop policy family_read on public.attachments;
drop policy family_read on public.events;
drop policy family_read on public.bring_items;
drop policy family_read on public.payments;
drop policy family_read on public.action_required;
drop policy family_read on public.closures;
drop policy family_read on public.facts;
drop policy family_read on public.children;
drop policy family_read on public.item_changes;
drop policy family_read on public.contact_roles;

create policy family_read on public.families for select to authenticated
  using (id = (select public.my_family()) or (select public.is_admin()));
create policy family_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or family_id = (select public.my_family()) or (select public.is_admin()));
create policy family_read on public.children for select to authenticated
  using (family_id = (select public.my_family()));
create policy family_read on public.wa_groups for select to authenticated
  using (public.visible_group(id));
create policy family_read on public.messages for select to authenticated
  using (public.visible_group(group_id));
-- Through the message: its own policy decides.
create policy family_read on public.attachments for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id));
create policy family_read on public.events for select to authenticated
  using (public.visible_group(group_id) and (family_id is null or family_id = (select public.my_family()) or (select public.is_admin())));
create policy family_read on public.bring_items for select to authenticated
  using (public.visible_group(group_id) and (family_id is null or family_id = (select public.my_family()) or (select public.is_admin())));
create policy family_read on public.payments for select to authenticated
  using (public.visible_group(group_id) and (family_id is null or family_id = (select public.my_family()) or (select public.is_admin())));
create policy family_read on public.action_required for select to authenticated
  using (public.visible_group(group_id));
create policy family_read on public.closures for select to authenticated
  using (public.visible_group(group_id));
create policy family_read on public.facts for select to authenticated
  using (public.visible_group(group_id));
create policy family_read on public.item_changes for select to authenticated
  using (public.item_visible(item_type, item_id));
-- Teachers and other parents for everyone; a family member's own number only within the family.
create policy family_read on public.contact_roles for select to authenticated
  using (
    (select public.is_admin())
    or ((select public.is_family()) and (profile_id is null or exists (select 1 from public.profiles p where p.id = profile_id)))
  );

-- ---------------------------------------------------------------------------
-- "Done" marks per family
-- ---------------------------------------------------------------------------

create table public.item_done (
  item_type text not null check (item_type in ('bring_item', 'payment', 'action_required')),
  item_id uuid not null,
  family_id uuid not null references public.families (id) on delete cascade,
  done_by uuid references public.profiles (id) on delete set null,
  done_at timestamptz not null default now(),
  -- action_required: the chosen suggestion's label ("Tak, zapisujemy").
  resolution text check (resolution is null or char_length(resolution) <= 60),
  primary key (item_type, item_id, family_id)
);

alter table public.item_done enable row level security;
create policy family_read on public.item_done for select to authenticated
  using (family_id = (select public.my_family()));
revoke all on public.item_done from anon;
revoke insert, update, delete, truncate on public.item_done from authenticated;

insert into public.item_done (item_type, item_id, family_id, done_by, done_at)
  select 'bring_item', id, public.default_family(), packed_by, packed_at from public.bring_items where packed_at is not null;
insert into public.item_done (item_type, item_id, family_id, done_by, done_at)
  select 'payment', id, public.default_family(), paid_by, paid_at from public.payments where paid_at is not null;
insert into public.item_done (item_type, item_id, family_id, done_by, done_at, resolution)
  select 'action_required', id, public.default_family(), resolved_by, resolved_at, resolution
    from public.action_required where resolved_at is not null;

drop function public.mark_packed(uuid, boolean);
drop function public.mark_paid(uuid, boolean);
drop function public.mark_resolved(uuid, boolean);

alter table public.bring_items drop column packed_by, drop column packed_at;
alter table public.payments drop column paid_by, drop column paid_at;
alter table public.action_required drop column resolved_by, drop column resolved_at, drop column resolution;

-- Items with the caller's family marks under the old column names (security invoker: the
-- items' own RLS applies).
create view public.family_bring_items with (security_invoker = true) as
select t.*, d.done_by as packed_by, d.done_at as packed_at
  from public.bring_items t
  left join public.item_done d on d.item_type = 'bring_item' and d.item_id = t.id and d.family_id = (select public.my_family());

create view public.family_payments with (security_invoker = true) as
select t.*, d.done_by as paid_by, d.done_at as paid_at
  from public.payments t
  left join public.item_done d on d.item_type = 'payment' and d.item_id = t.id and d.family_id = (select public.my_family());

create view public.family_action_required with (security_invoker = true) as
select t.*, d.done_by as resolved_by, d.done_at as resolved_at, d.resolution
  from public.action_required t
  left join public.item_done d on d.item_type = 'action_required' and d.item_id = t.id and d.family_id = (select public.my_family());

revoke all on public.family_bring_items, public.family_payments, public.family_action_required from anon, public;
grant select on public.family_bring_items, public.family_payments, public.family_action_required to authenticated;

-- Marks (or clears) an item as done for the caller's family; the item must be visible to them.
create function public.mark_done(p_type text, p_id uuid, p_done boolean, p_resolution text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_family uuid := public.my_family();
  v_active boolean;
begin
  if not public.is_family() or v_family is null then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  case p_type
    when 'bring_item' then select status <> 'cancelled' into v_active from public.bring_items where id = p_id;
    when 'payment' then select status <> 'cancelled' into v_active from public.payments where id = p_id;
    when 'action_required' then select status <> 'cancelled' into v_active from public.action_required where id = p_id;
    else raise exception 'Nieznany rodzaj.' using errcode = '22023';
  end case;
  if not coalesce(v_active, false) or not public.item_visible(p_type, p_id) then
    raise exception 'Nie ma takiej pozycji.' using errcode = 'P0002';
  end if;
  if p_done then
    insert into public.item_done (item_type, item_id, family_id, done_by, done_at, resolution)
      values (p_type, p_id, v_family, auth.uid(), now(), p_resolution)
    on conflict (item_type, item_id, family_id) do update
      set done_by = excluded.done_by, done_at = excluded.done_at, resolution = excluded.resolution;
  else
    delete from public.item_done where item_type = p_type and item_id = p_id and family_id = v_family;
  end if;
end;
$$;

create function public.mark_packed(p_id uuid, p_done boolean) returns void
language sql security definer
set search_path = ''
as $$ select public.mark_done('bring_item', p_id, p_done) $$;

create function public.mark_paid(p_id uuid, p_done boolean) returns void
language sql security definer
set search_path = ''
as $$ select public.mark_done('payment', p_id, p_done) $$;

create function public.mark_resolved(p_id uuid, p_done boolean) returns void
language sql security definer
set search_path = ''
as $$ select public.mark_done('action_required', p_id, p_done) $$;

-- A family's choice on a "wymaga odpowiedzi" item: what it creates belongs to that family, and
-- the item is resolved for that family only.
create or replace function public.apply_action_suggestion(p_id uuid, p_index integer)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.action_required;
  v_family uuid := public.my_family();
  v_s jsonb;
  v_kind text;
  v_label text;
  v_description text;
  v_due date;
  v_created uuid;
  v_note text;
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
begin
  if not public.is_family() or v_family is null then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  select * into v_row from public.action_required
   where id = p_id and status = 'active'
     and not exists (
       select 1 from public.item_done d
        where d.item_type = 'action_required' and d.item_id = p_id and d.family_id = v_family
     )
   for update;
  if v_row.id is null or not public.visible_group(v_row.group_id) then
    raise exception 'Nie ma takiej otwartej sprawy.' using errcode = 'P0002';
  end if;
  v_s := v_row.suggested_actions -> p_index;
  if v_s is null or jsonb_typeof(v_s) <> 'object' then
    raise exception 'Nie ma takiej akcji.' using errcode = 'P0002';
  end if;
  v_kind := v_s ->> 'kind';
  v_label := left(coalesce(nullif(btrim(v_s ->> 'label'), ''), v_kind), 60);
  v_description := left(coalesce(nullif(btrim(v_s ->> 'description'), ''), v_row.question), 200);
  v_due := coalesce((v_s ->> 'due_date')::date, v_row.due_date);
  v_note := 'Z „Wymaga odpowiedzi”: ' || v_label;

  -- Picked now, so a thing to bring with a past or missing date is for the next school day
  -- (otherwise it lands in the past and never shows on the home screen).
  if v_kind = 'bring' and (v_due is null or v_due < v_today) then
    v_due := v_today + case extract(isodow from v_today) when 5 then 3 when 6 then 2 else 1 end;
  end if;

  case v_kind
    when 'bring' then
      insert into public.bring_items (group_id, family_id, description, due_date, child_ids, source_message_ids, confidence, rationale)
        values (v_row.group_id, v_family, v_description, v_due, v_row.child_ids, v_row.source_message_ids, v_row.confidence, v_note)
        returning id into v_created;
    when 'payment' then
      insert into public.payments (group_id, family_id, description, amount_pln, due_date, child_ids, source_message_ids, confidence, rationale)
        values (v_row.group_id, v_family, v_description, (v_s ->> 'amount_pln')::numeric, v_due, v_row.child_ids,
                v_row.source_message_ids, v_row.confidence, v_note)
        returning id into v_created;
    when 'event' then
      if v_due is null then
        raise exception 'Akcja nie ma daty wydarzenia.' using errcode = '22023';
      end if;
      insert into public.events (group_id, family_id, title, starts_at, all_day, child_ids, source_message_ids, confidence, rationale)
        values (v_row.group_id, v_family, v_description, v_due::timestamp at time zone 'Europe/Warsaw', true, v_row.child_ids,
                v_row.source_message_ids, v_row.confidence, v_note)
        returning id into v_created;
    when 'answer', 'done', 'not_applicable' then
      null;
    else
      raise exception 'Nieznana akcja.' using errcode = '22023';
  end case;

  insert into public.item_done (item_type, item_id, family_id, done_by, done_at, resolution)
    values ('action_required', p_id, v_family, auth.uid(), now(), v_label);
  return jsonb_build_object('kind', v_kind, 'created_id', v_created, 'due_date', case when v_created is not null then v_due end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Children per family
-- ---------------------------------------------------------------------------

drop index public.children_name_key;
drop index public.children_color_key;
create unique index children_name_key on public.children (family_id, lower(btrim(name)));
create unique index children_color_key on public.children (family_id, color) where color is not null;

-- When a family no longer sees a group (its last child there left or moved): what the family kept
-- for that group goes away – its own items created from its choices and its "done" marks.
create function public.family_forget_group(p_family uuid, p_group uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_group is null or public.family_sees_group(p_family, p_group) then
    return;
  end if;
  delete from public.item_done d
   where d.family_id = p_family
     and (
       (d.item_type = 'bring_item' and exists (select 1 from public.bring_items t where t.id = d.item_id and t.group_id = p_group))
       or (d.item_type = 'payment' and exists (select 1 from public.payments t where t.id = d.item_id and t.group_id = p_group))
       or (d.item_type = 'action_required' and exists (select 1 from public.action_required t where t.id = d.item_id and t.group_id = p_group))
     );
  delete from public.bring_items where family_id = p_family and group_id = p_group;
  delete from public.payments where family_id = p_family and group_id = p_group;
  delete from public.events where family_id = p_family and group_id = p_group;
end;
$$;

create or replace function public.save_child(
  p_id uuid, p_name text, p_group_id uuid, p_aliases text[] default '{}', p_color text default null
)
returns public.children
language plpgsql security definer
set search_path = ''
as $$
declare
  v_family uuid := public.my_family();
  v_row public.children;
  v_old_group uuid;
  v_aliases text[];
  v_clash text;
  v_color text := nullif(btrim(coalesce(p_color, '')), '');
begin
  if not public.is_family() or v_family is null then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  if p_group_id is not null and not exists (select 1 from public.wa_groups where id = p_group_id and tracked) then
    raise exception 'Nie ma takiej grupy.' using errcode = 'P0002';
  end if;
  -- Trimmed, non-empty, without the name itself and without duplicates (first spelling wins).
  select coalesce(array_agg(a order by ord), '{}') into v_aliases
    from (
      select distinct on (lower(btrim(a))) btrim(a) as a, ord
        from unnest(coalesce(p_aliases, '{}')) with ordinality as t(a, ord)
       where btrim(a) <> '' and lower(btrim(a)) <> lower(btrim(p_name))
       order by lower(btrim(a)), ord
    ) s;
  if cardinality(v_aliases) > 10 then
    raise exception 'Najwyżej 10 innych form imienia.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_aliases) a where char_length(a) > 40) then
    raise exception 'Forma imienia może mieć najwyżej 40 znaków.' using errcode = '22023';
  end if;
  -- Names and colours are unique within the family; other families may use the same ones.
  select f into v_clash
    from public.children c, unnest(public.child_name_forms(c.name, c.aliases)) f
   where c.family_id = v_family and c.id is distinct from p_id
     and f = any(public.child_name_forms(p_name, v_aliases))
   limit 1;
  if v_clash is not null then
    raise exception 'Forma „%” należy już do innego dziecka.', v_clash using errcode = '23505';
  end if;
  if v_color is not null and not (v_color = any(public.child_colors())) then
    raise exception 'Nieznany kolor.' using errcode = '22023';
  end if;
  if v_color is not null
     and exists (select 1 from public.children where family_id = v_family and color = v_color and id is distinct from p_id) then
    raise exception 'Ten kolor ma już inne dziecko.' using errcode = '23505';
  end if;
  if p_id is null then
    -- A new child without a chosen colour gets the family's first free one.
    v_color := coalesce(v_color, (
      select c from unnest(public.child_colors()) with ordinality as t(c, ord)
       where not exists (select 1 from public.children where family_id = v_family and color = t.c)
       order by ord limit 1
    ));
    insert into public.children (family_id, name, group_id, aliases, color)
      values (v_family, btrim(p_name), p_group_id, v_aliases, v_color) returning * into v_row;
  else
    select group_id into v_old_group from public.children where id = p_id and family_id = v_family;
    -- No colour given: the current one stays.
    update public.children
       set name = btrim(p_name), group_id = p_group_id, aliases = v_aliases, color = coalesce(v_color, color)
     where id = p_id and family_id = v_family returning * into v_row;
    if v_row.id is null then
      raise exception 'Nie ma takiego dziecka.' using errcode = 'P0002';
    end if;
    -- Moved to another group: the family may no longer see the old one.
    if v_old_group is distinct from p_group_id then
      perform public.family_forget_group(v_family, v_old_group);
    end if;
  end if;
  return v_row;
end;
$$;

create or replace function public.delete_child(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_family uuid := public.my_family();
  v_group uuid;
  v_found boolean := false;
begin
  if not public.is_family() then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  delete from public.children where id = p_id and family_id = v_family returning group_id, true into v_group, v_found;
  if not v_found then
    return;
  end if;
  -- Items no longer point at the child, and the family's leftovers of a group it stops seeing go.
  update public.events set child_ids = array_remove(child_ids, p_id) where p_id = any(child_ids);
  update public.bring_items set child_ids = array_remove(child_ids, p_id) where p_id = any(child_ids);
  update public.payments set child_ids = array_remove(child_ids, p_id) where p_id = any(child_ids);
  update public.action_required set child_ids = array_remove(child_ids, p_id) where p_id = any(child_ids);
  perform public.family_forget_group(v_family, v_group);
end;
$$;

-- Tracked groups a family can pick for a child (it does not see their content until then).
create function public.trackable_groups()
returns table (id uuid, name text, shared boolean)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_family() then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  return query
    select g.id, coalesce(g.display_name, g.wa_name), g.shared
      from public.wa_groups g
     where g.tracked
     order by lower(coalesce(g.display_name, g.wa_name));
end;
$$;

-- ---------------------------------------------------------------------------
-- Groups and images
-- ---------------------------------------------------------------------------

drop function public.admin_update_group(uuid, boolean, text);

create function public.admin_update_group(p_id uuid, p_tracked boolean, p_display_name text, p_shared boolean default null)
returns public.wa_groups
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.wa_groups;
begin
  perform public.assert_admin();
  update public.wa_groups
     set tracked = coalesce(p_tracked, tracked),
         shared = coalesce(p_shared, shared),
         display_name = nullif(btrim(coalesce(p_display_name, '')), '')
   where id = p_id
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Nie ma takiej grupy.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- Only images from groups the caller sees.
create or replace function public.attachment_image(p_attachment_id uuid)
returns table (mime text, data text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_family() then
    raise exception 'Brak dostępu.' using errcode = '42501';
  end if;
  return query
    select f.mime, translate(encode(f.bytes, 'base64'), E'\n', '')
      from public.attachment_files f
      join public.attachments a on a.id = f.attachment_id
      join public.messages m on m.id = a.message_id
     where f.attachment_id = p_attachment_id and a.doc_status = 'ready' and public.visible_group(m.group_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function public.default_family() from public, anon, authenticated;
revoke execute on function public.family_forget_group(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.allowed_email_family() from public, anon, authenticated;
revoke execute on function public.my_family() from public, anon;
revoke execute on function public.family_sees_group(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.visible_group(uuid) from public, anon;
revoke execute on function public.item_visible(text, uuid) from public, anon;
revoke execute on function public.mark_done(text, uuid, boolean, text) from public, anon;
revoke execute on function public.mark_packed(uuid, boolean) from public, anon;
revoke execute on function public.mark_paid(uuid, boolean) from public, anon;
revoke execute on function public.mark_resolved(uuid, boolean) from public, anon;
revoke execute on function public.trackable_groups() from public, anon;
revoke execute on function public.admin_update_group(uuid, boolean, text, boolean) from public, anon;
grant execute on function public.my_family() to authenticated, service_role;
grant execute on function public.family_sees_group(uuid, uuid) to service_role;
grant execute on function public.visible_group(uuid) to authenticated, service_role;
grant execute on function public.item_visible(text, uuid) to authenticated, service_role;
grant execute on function public.mark_done(text, uuid, boolean, text) to authenticated;
grant execute on function public.mark_packed(uuid, boolean) to authenticated;
grant execute on function public.mark_paid(uuid, boolean) to authenticated;
grant execute on function public.mark_resolved(uuid, boolean) to authenticated;
grant execute on function public.trackable_groups() to authenticated;
grant execute on function public.admin_update_group(uuid, boolean, text, boolean) to authenticated;
