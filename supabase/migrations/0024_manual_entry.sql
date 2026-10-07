-- Manual entry (manual-entry): the admin adds a group by name before its first notification
-- and pastes messages copied from WhatsApp.

alter table public.messages drop constraint messages_source_check;
alter table public.messages add constraint messages_source_check check (source in ('notification', 'export', 'manual'));

alter table public.sync_log drop constraint sync_log_kind_check;
alter table public.sync_log add constraint sync_log_kind_check check (kind in ('notification', 'export', 'extraction', 'document', 'manual'));

-- Adds a tracked group under its normalized name; an existing group (e.g. reported by the
-- phone but not tracked) is switched to tracked instead of duplicated.
create function public.admin_add_group(p_name text, p_display_name text default null)
returns public.wa_groups
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text := public.normalize_group_name(coalesce(p_name, ''));
  v_row public.wa_groups;
begin
  perform public.assert_admin();
  if v_name = '' then
    raise exception 'Podaj nazwę grupy.' using errcode = '22023';
  end if;
  if length(v_name) > 200 then
    raise exception 'Nazwa grupy jest za długa.' using errcode = '22023';
  end if;
  insert into public.wa_groups (wa_name, display_name, tracked)
  values (v_name, nullif(btrim(coalesce(p_display_name, '')), ''), true)
  on conflict (wa_name) do update
     set tracked = true,
         display_name = coalesce(excluded.display_name, public.wa_groups.display_name)
  returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.admin_add_group(text, text) from public, anon;
grant execute on function public.admin_add_group(text, text) to authenticated;
