-- Other forms of a child's name (family-children): nicknames and full forms the
-- extraction model and the assistant should recognise ("Elena" = "Eleonora", "Elcia").
-- Admins can also send a message back to extraction (item-extraction), e.g. after
-- adding a name form.

alter table public.children
  add column aliases text[] not null default '{}'
    check (cardinality(aliases) <= 10);

-- Lowercased, trimmed names and aliases; one form must point at one child.
create function public.child_name_forms(p_name text, p_aliases text[])
returns text[]
language sql immutable
set search_path = ''
as $$
  select array_agg(distinct lower(btrim(f)))
    from unnest(array_prepend(p_name, coalesce(p_aliases, '{}'))) f
   where btrim(f) <> '';
$$;

drop function public.save_child(uuid, text, uuid);

create function public.save_child(p_id uuid, p_name text, p_group_id uuid, p_aliases text[] default '{}')
returns public.children
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.children;
  v_aliases text[];
  v_clash text;
begin
  if not public.is_family() then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  if p_group_id is not null and not exists (select 1 from public.wa_groups where id = p_group_id) then
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
  select f into v_clash
    from public.children c, unnest(public.child_name_forms(c.name, c.aliases)) f
   where c.id is distinct from p_id
     and f = any(public.child_name_forms(p_name, v_aliases))
   limit 1;
  if v_clash is not null then
    raise exception 'Forma „%” należy już do innego dziecka.', v_clash using errcode = '23505';
  end if;
  if p_id is null then
    insert into public.children (name, group_id, aliases)
      values (btrim(p_name), p_group_id, v_aliases) returning * into v_row;
  else
    update public.children set name = btrim(p_name), group_id = p_group_id, aliases = v_aliases
     where id = p_id returning * into v_row;
    if v_row.id is null then
      raise exception 'Nie ma takiego dziecka.' using errcode = 'P0002';
    end if;
  end if;
  return v_row;
end;
$$;

revoke execute on function public.save_child(uuid, text, uuid, text[]) from public, anon;
grant execute on function public.save_child(uuid, text, uuid, text[]) to authenticated;
revoke all on function public.child_name_forms(text, text[]) from public, anon;
grant execute on function public.child_name_forms(text, text[]) to authenticated;

-- Admin: analyse one message again on the next worker pass (realtime wake-up included).
create function public.admin_reprocess_message(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_group uuid;
begin
  perform public.assert_admin();
  update public.messages set processed_at = null
   where id = p_id and status = 'active'
  returning group_id into v_group;
  if v_group is null then
    raise exception 'Nie ma takiej wiadomości.' using errcode = 'P0002';
  end if;
  perform pg_notify('message_ingested', v_group::text);
end;
$$;

revoke execute on function public.admin_reprocess_message(uuid) from public, anon;
grant execute on function public.admin_reprocess_message(uuid) to authenticated;
