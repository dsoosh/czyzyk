-- Audience of items (families, two-step extraction): the analysis of a group runs once for every
-- family and writes the children's names an item is about ("audience"); the database assigns
-- the matching children of any family (child_ids) and decides which families see the item.

alter table public.events
  add column audience text[] not null default '{}',
  add column extra_group_ids uuid[] not null default '{}';
alter table public.bring_items
  add column audience text[] not null default '{}',
  add column extra_group_ids uuid[] not null default '{}';
alter table public.payments
  add column audience text[] not null default '{}',
  add column extra_group_ids uuid[] not null default '{}';
alter table public.action_required
  add column audience text[] not null default '{}',
  add column extra_group_ids uuid[] not null default '{}';

-- Existing assignments become the audience; children of other groups (joined items) add their groups.
do $$
declare
  t text;
begin
  foreach t in array array['events', 'bring_items', 'payments', 'action_required'] loop
    execute format(
      $sql$update public.%I x
              set audience = array(select c.name from public.children c where c.id = any(x.child_ids) order by c.name),
                  extra_group_ids = array(
                    select distinct c.group_id from public.children c
                     where c.id = any(x.child_ids) and c.group_id is not null and c.group_id is distinct from x.group_id)
            where cardinality(x.child_ids) > 0$sql$,
      t);
  end loop;
end
$$;

-- Children of any family in the given groups whose name or other form matches an audience name.
-- A shared group or the whole kindergarten (null) matches children of any group.
create function public.audience_children(p_audience text[], p_groups uuid[]) returns uuid[]
language sql stable security definer
set search_path = ''
as $$
  select coalesce(array_agg(c.id order by c.name), '{}')
    from public.children c
   where cardinality(coalesce(p_audience, '{}')) > 0
     and public.child_name_forms(c.name, c.aliases) && array(select lower(btrim(a)) from unnest(p_audience) a)
     and (
       c.group_id = any(p_groups)
       or exists (select 1 from unnest(p_groups) g where g is null)
       or exists (select 1 from public.wa_groups w where w.id = any(p_groups) and w.shared)
     )
$$;

-- Recomputes child_ids of addressed items: after an extraction and when children change.
create function public.refresh_item_children() returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  t text;
begin
  foreach t in array array['events', 'bring_items', 'payments', 'action_required'] loop
    execute format(
      $sql$update public.%1$I x set child_ids = v.ids
             from (select id, public.audience_children(audience, array[group_id] || extra_group_ids) as ids
                     from public.%1$I where cardinality(audience) > 0) v
            where x.id = v.id and x.child_ids is distinct from v.ids$sql$,
      t);
  end loop;
end;
$$;

select public.refresh_item_children();

-- A family sees an item when it sees one of its groups and the item is for the whole group or
-- one of its children; items created from a family's own choice only that family.
create function public.family_sees_item(
  p_family uuid, p_group uuid, p_extra uuid[], p_audience text[], p_child_ids uuid[], p_owner uuid
) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (p_owner is null or p_owner = p_family)
     and (public.family_sees_group(p_family, p_group)
          or exists (select 1 from unnest(coalesce(p_extra, '{}')) g where public.family_sees_group(p_family, g)))
     and (cardinality(coalesce(p_audience, '{}')) = 0
          or exists (select 1 from public.children c where c.family_id = p_family and c.id = any(p_child_ids)))
$$;

create function public.item_row_visible(
  p_group uuid, p_extra uuid[], p_audience text[], p_child_ids uuid[], p_owner uuid
) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin()
      or (public.is_family() and public.family_sees_item(public.my_family(), p_group, p_extra, p_audience, p_child_ids, p_owner))
$$;

drop policy family_read on public.events;
drop policy family_read on public.bring_items;
drop policy family_read on public.payments;
drop policy family_read on public.action_required;
create policy family_read on public.events for select to authenticated
  using (public.item_row_visible(group_id, extra_group_ids, audience, child_ids, family_id));
create policy family_read on public.bring_items for select to authenticated
  using (public.item_row_visible(group_id, extra_group_ids, audience, child_ids, family_id));
create policy family_read on public.payments for select to authenticated
  using (public.item_row_visible(group_id, extra_group_ids, audience, child_ids, family_id));
create policy family_read on public.action_required for select to authenticated
  using (public.item_row_visible(group_id, extra_group_ids, audience, child_ids, null));

create or replace function public.item_visible(p_type text, p_id uuid) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_visible boolean;
begin
  case p_type
    when 'event' then
      select public.item_row_visible(group_id, extra_group_ids, audience, child_ids, family_id) into v_visible from public.events where id = p_id;
    when 'bring_item' then
      select public.item_row_visible(group_id, extra_group_ids, audience, child_ids, family_id) into v_visible from public.bring_items where id = p_id;
    when 'payment' then
      select public.item_row_visible(group_id, extra_group_ids, audience, child_ids, family_id) into v_visible from public.payments where id = p_id;
    when 'action_required' then
      select public.item_row_visible(group_id, extra_group_ids, audience, child_ids, null) into v_visible from public.action_required where id = p_id;
    when 'closure' then select public.visible_group(group_id) into v_visible from public.closures where id = p_id;
    when 'fact' then select public.visible_group(group_id) into v_visible from public.facts where id = p_id;
    else return false;
  end case;
  return coalesce(v_visible, false);
end;
$$;

-- The extraction prompt no longer takes children or family members (they come in the request);
-- must match PROMPT_PLACEHOLDERS in @czyzyk/shared.
create or replace function public.llm_prompt_placeholders(p_key text)
returns text[]
language sql immutable
set search_path = ''
as $$
  select case p_key
    when 'extraction' then array['przedszkole']
    when 'assistant' then array['przedszkole', 'dzieci', 'rodzina', 'uzytkownik']
  end;
$$;

-- A family's choice copies the item's audience and groups to what it creates.
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
  if v_row.id is null or not public.item_visible('action_required', p_id) then
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
      insert into public.bring_items (group_id, family_id, description, due_date, child_ids, audience, extra_group_ids, source_message_ids, confidence, rationale)
        values (v_row.group_id, v_family, v_description, v_due, v_row.child_ids, v_row.audience, v_row.extra_group_ids, v_row.source_message_ids, v_row.confidence, v_note)
        returning id into v_created;
    when 'payment' then
      insert into public.payments (group_id, family_id, description, amount_pln, due_date, child_ids, audience, extra_group_ids, source_message_ids, confidence, rationale)
        values (v_row.group_id, v_family, v_description, (v_s ->> 'amount_pln')::numeric, v_due, v_row.child_ids, v_row.audience, v_row.extra_group_ids,
                v_row.source_message_ids, v_row.confidence, v_note)
        returning id into v_created;
    when 'event' then
      if v_due is null then
        raise exception 'Akcja nie ma daty wydarzenia.' using errcode = '22023';
      end if;
      insert into public.events (group_id, family_id, title, starts_at, all_day, child_ids, audience, extra_group_ids, source_message_ids, confidence, rationale)
        values (v_row.group_id, v_family, v_description, v_due::timestamp at time zone 'Europe/Warsaw', true, v_row.child_ids, v_row.audience, v_row.extra_group_ids,
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
  -- Names may now match items addressed to this child (or no longer do).
  perform public.refresh_item_children();
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
  perform public.refresh_item_children();
end;
$$;

revoke execute on function public.audience_children(text[], uuid[]) from public, anon, authenticated;
revoke execute on function public.refresh_item_children() from public, anon, authenticated;
revoke execute on function public.family_sees_item(uuid, uuid, uuid[], text[], uuid[], uuid) from public, anon, authenticated;
revoke execute on function public.item_row_visible(uuid, uuid[], text[], uuid[], uuid) from public, anon;
grant execute on function public.audience_children(text[], uuid[]) to service_role;
grant execute on function public.refresh_item_children() to service_role;
grant execute on function public.family_sees_item(uuid, uuid, uuid[], text[], uuid[], uuid) to service_role;
grant execute on function public.item_row_visible(uuid, uuid[], text[], uuid[], uuid) to authenticated, service_role;
