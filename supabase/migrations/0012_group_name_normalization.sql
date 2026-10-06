-- One spelling per group name (group-tracking): same rule as normalizeGroupName in
-- packages/shared and NotificationParser on the phone. Names from Android notifications
-- may carry invisible bidi isolates (U+2068/U+2069) or decomposed Polish letters, which
-- created look-alike duplicate groups. This migration merges them.

create function public.normalize_group_name(p_name text)
returns text
language sql immutable strict
set search_path = ''
as $$
  select btrim(regexp_replace(
    regexp_replace(normalize(p_name, nfc), '[­؜᠎​-‏‪-‮⁠-⁩﻿]', '', 'g'),
    '[[:space:] ]+', ' ', 'g'
  ))
$$;

do $$
declare
  dup record;
  keeper uuid;
  others uuid[];
begin
  for dup in
    select public.normalize_group_name(wa_name) as name
      from public.wa_groups
     group by 1
    having count(*) > 1
  loop
    -- Keep the tracked group, then the one with most messages, then the oldest.
    select g.id into keeper
      from public.wa_groups g
     where public.normalize_group_name(g.wa_name) = dup.name
     order by g.tracked desc,
              (select count(*) from public.messages m where m.group_id = g.id) desc,
              g.created_at
     limit 1;
    select array_agg(g.id) into others
      from public.wa_groups g
     where public.normalize_group_name(g.wa_name) = dup.name and g.id <> keeper;

    -- Message keys include the group id, so moving them keeps (group_id, dedupe_key) unique.
    update public.messages set group_id = keeper where group_id = any(others);
    update public.events set group_id = keeper where group_id = any(others);
    update public.bring_items set group_id = keeper where group_id = any(others);
    update public.payments set group_id = keeper where group_id = any(others);
    update public.action_required set group_id = keeper where group_id = any(others);
    update public.closures set group_id = keeper where group_id = any(others);
    update public.facts set group_id = keeper where group_id = any(others);
    update public.children set group_id = keeper where group_id = any(others);

    update public.wa_groups k
       set tracked = k.tracked or o.tracked,
           display_name = coalesce(k.display_name, o.display_name),
           last_notification_at = greatest(k.last_notification_at, o.last_notification_at),
           last_export_at = greatest(k.last_export_at, o.last_export_at)
      from (
        select bool_or(tracked) as tracked,
               (array_agg(display_name order by created_at) filter (where display_name is not null))[1] as display_name,
               max(last_notification_at) as last_notification_at,
               max(last_export_at) as last_export_at
          from public.wa_groups where id = any(others)
      ) o
     where k.id = keeper;

    delete from public.wa_groups where id = any(others);
  end loop;

  update public.wa_groups
     set wa_name = public.normalize_group_name(wa_name)
   where wa_name <> public.normalize_group_name(wa_name);
end;
$$;

revoke execute on function public.normalize_group_name(text) from public, anon;
grant execute on function public.normalize_group_name(text) to authenticated, service_role;
