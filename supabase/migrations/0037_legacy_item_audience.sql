-- Audience of old items (families): items extracted before the two-step extraction only kept the
-- operator's children they concerned, for whole-group announcements too, so neither "addressed to
-- that child" (0033) nor "whole group" (0036) is right for all of them. Their audience now comes
-- from the source messages: the children (of any family) named there, also in an inflected form;
-- none named means the whole group. It is recomputed whenever children change, so a child added
-- later and named in an old message gets the item.

alter table public.events add column legacy_audience boolean not null default false;
alter table public.bring_items add column legacy_audience boolean not null default false;
alter table public.payments add column legacy_audience boolean not null default false;
alter table public.action_required add column legacy_audience boolean not null default false;

-- Lower-case regex matching a name form and its inflections ("zosia": zosi, zosię, zosią; "antek":
-- antka, antkowi) as a whole word. Short forms (up to 3 letters) only match exactly.
create function public.name_form_pattern(p_form text) returns text
language sql immutable
set search_path = ''
as $$
  with f as (select regexp_replace(lower(btrim(p_form)), '[^a-ząćęłńóśźż ]', '', 'g') as form)
  select '(^|[^a-ząćęłńóśźż])'
      || case
           when length(form) > 4 then left(form, length(form) - 2) || '[a-ząćęłńóśźż]{0,5}'
           when length(form) = 4 then left(form, 3) || '[a-ząćęłńóśźż]{0,4}'
           else form
         end
      || '($|[^a-ząćęłńóśźż])'
    from f
   where length(form) >= 2
$$;

-- Names of the children of the item's groups (any child for a shared group or the whole
-- kindergarten) named in the given messages.
create function public.named_children(p_message_ids uuid[], p_groups uuid[]) returns text[]
language sql stable security definer
set search_path = ''
as $$
  with t as (
    select lower(string_agg(m.text, E'\n')) as body from public.messages m where m.id = any(p_message_ids)
  )
  select coalesce(array_agg(distinct c.name order by c.name), '{}')
    from public.children c, t
   where t.body is not null
     and (
       c.group_id = any(p_groups)
       or exists (select 1 from unnest(p_groups) g where g is null)
       or exists (select 1 from public.wa_groups w where w.id = any(p_groups) and w.shared)
     )
     and exists (
       select 1 from unnest(public.child_name_forms(c.name, c.aliases)) f
        where public.name_form_pattern(f) is not null and t.body ~ public.name_form_pattern(f)
     )
$$;

revoke execute on function public.named_children(uuid[], uuid[]) from public, anon, authenticated;

-- Old items assigned to children (before the two-step extraction went live).
do $$
declare
  t text;
begin
  foreach t in array array['events', 'bring_items', 'payments', 'action_required'] loop
    execute format(
      $sql$update public.%I set legacy_audience = true
            where created_at < '2026-10-09 11:18:43+00' and cardinality(child_ids) > 0 %s$sql$,
      t,
      case when t = 'action_required' then '' else 'and family_id is null' end);
  end loop;
end
$$;

-- Recomputes child_ids of addressed items (after an extraction and when children change); old
-- items first get their audience from the source messages.
create or replace function public.refresh_item_children() returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  t text;
begin
  foreach t in array array['events', 'bring_items', 'payments', 'action_required'] loop
    execute format(
      $sql$update public.%1$I x set audience = v.names
             from (select id, public.named_children(source_message_ids, array[group_id] || extra_group_ids) as names
                     from public.%1$I where legacy_audience) v
            where x.id = v.id and x.audience is distinct from v.names$sql$,
      t);
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
