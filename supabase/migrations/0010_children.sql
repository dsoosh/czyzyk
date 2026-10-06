-- Children of the family (family-children): names the extraction model can match
-- in messages, and the group each child attends. Items may point at children.

create table public.children (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  group_id uuid references public.wa_groups (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- A name in a message must point at exactly one child.
create unique index children_name_key on public.children (lower(btrim(name)));

create trigger set_updated_at before update on public.children
  for each row execute function public.set_updated_at();

alter table public.children enable row level security;
create policy family_read on public.children for select to authenticated using ((select public.is_family()));
revoke all on public.children from anon;
revoke insert, update, delete, truncate on public.children from authenticated;

-- Empty = the item concerns the whole group (or kindergarten).
alter table public.events add column child_ids uuid[] not null default '{}';
alter table public.bring_items add column child_ids uuid[] not null default '{}';
alter table public.payments add column child_ids uuid[] not null default '{}';
alter table public.action_required add column child_ids uuid[] not null default '{}';

-- Any family member manages the children; p_id null creates a new one.
create function public.save_child(p_id uuid, p_name text, p_group_id uuid)
returns public.children
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.children;
begin
  if not public.is_family() then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  if p_group_id is not null and not exists (select 1 from public.wa_groups where id = p_group_id) then
    raise exception 'Nie ma takiej grupy.' using errcode = 'P0002';
  end if;
  if p_id is null then
    insert into public.children (name, group_id) values (btrim(p_name), p_group_id) returning * into v_row;
  else
    update public.children set name = btrim(p_name), group_id = p_group_id where id = p_id returning * into v_row;
    if v_row.id is null then
      raise exception 'Nie ma takiego dziecka.' using errcode = 'P0002';
    end if;
  end if;
  return v_row;
end;
$$;

create function public.delete_child(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_family() then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  delete from public.children where id = p_id;
end;
$$;

revoke execute on function public.save_child(uuid, text, uuid) from public, anon;
revoke execute on function public.delete_child(uuid) from public, anon;
grant execute on function public.save_child(uuid, text, uuid) to authenticated;
grant execute on function public.delete_child(uuid) to authenticated;
