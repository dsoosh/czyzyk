-- Whole-group items (families): before the two-step extraction the model listed the operator's
-- children an item concerned, also for whole-group announcements, and 0033 turned that list into
-- the audience. Such old items addressed to exactly all the first family's children of the item's
-- groups become whole-group items again, so every family with a child in the group sees them.

do $$
declare
  t text;
  v_family uuid := (select id from public.families order by created_at, id limit 1);
begin
  if v_family is null then
    return;
  end if;
  foreach t in array array['events', 'bring_items', 'payments', 'action_required'] loop
    execute format(
      $sql$update public.%I x set audience = '{}'
            where x.created_at < '2026-10-09 11:18:43+00'
              and cardinality(x.audience) > 0
              and %s
              and (select coalesce(array_agg(lower(btrim(c.name)) order by lower(btrim(c.name))), '{}')
                     from public.children c
                    where c.family_id = $1 and c.group_id = any(array[x.group_id] || x.extra_group_ids))
                = (select array_agg(distinct lower(btrim(a)) order by lower(btrim(a))) from unnest(x.audience) a)$sql$,
      t,
      case when t = 'action_required' then 'true' else 'x.family_id is null' end)
    using v_family;
  end loop;
end
$$;
