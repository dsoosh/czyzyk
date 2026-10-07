-- Child colours (child-colors): each child has its own colour on items, chosen by the family.
-- Keys only; the PWA maps them to its palette (apps/pwa/src/lib/children.ts).

create function public.child_colors()
returns text[]
language sql immutable
set search_path = ''
as $$
  select array['lime', 'sky', 'rose', 'amber', 'violet', 'teal', 'orange', 'sand']
$$;

alter table public.children
  add column color text check (color is null or color = any(public.child_colors()));
create unique index children_color_key on public.children (color) where color is not null;

-- Existing children get distinct colours in the order they were added.
update public.children c
   set color = (public.child_colors())[s.rn]
  from (select id, row_number() over (order by created_at, id) as rn from public.children) s
 where s.id = c.id and s.rn <= cardinality(public.child_colors());

drop function public.save_child(uuid, text, uuid, text[]);

create function public.save_child(
  p_id uuid, p_name text, p_group_id uuid, p_aliases text[] default '{}', p_color text default null
)
returns public.children
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.children;
  v_aliases text[];
  v_clash text;
  v_color text := nullif(btrim(coalesce(p_color, '')), '');
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
  if v_color is not null and not (v_color = any(public.child_colors())) then
    raise exception 'Nieznany kolor.' using errcode = '22023';
  end if;
  if v_color is not null and exists (select 1 from public.children where color = v_color and id is distinct from p_id) then
    raise exception 'Ten kolor ma już inne dziecko.' using errcode = '23505';
  end if;
  if p_id is null then
    -- A new child without a chosen colour gets the first free one.
    v_color := coalesce(v_color, (
      select c from unnest(public.child_colors()) with ordinality as t(c, ord)
       where not exists (select 1 from public.children where color = t.c)
       order by ord limit 1
    ));
    insert into public.children (name, group_id, aliases, color)
      values (btrim(p_name), p_group_id, v_aliases, v_color) returning * into v_row;
  else
    -- No colour given: the current one stays.
    update public.children
       set name = btrim(p_name), group_id = p_group_id, aliases = v_aliases, color = coalesce(v_color, color)
     where id = p_id returning * into v_row;
    if v_row.id is null then
      raise exception 'Nie ma takiego dziecka.' using errcode = 'P0002';
    end if;
  end if;
  return v_row;
end;
$$;

revoke execute on function public.save_child(uuid, text, uuid, text[], text) from public, anon;
grant execute on function public.save_child(uuid, text, uuid, text[], text) to authenticated;
revoke all on function public.child_colors() from public, anon;
grant execute on function public.child_colors() to authenticated;
