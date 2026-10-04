-- Stage 2: notification ingest, device tokens, tracked groups and source context.

alter table public.messages
  add column idempotency_key text unique,
  add column received_at timestamptz not null default now();

-- Debounce scan: unprocessed messages per group, newest arrival first.
create index messages_unprocessed_received_idx
  on public.messages (group_id, received_at desc)
  where processed_at is null;

-- ---------------------------------------------------------------------------
-- Devices (device-pairing). The token is shown once; only its sha256 is stored.
-- ---------------------------------------------------------------------------

create function public.admin_create_device(p_name text)
returns table (id uuid, name text, token text)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_name text := btrim(coalesce(p_name, ''));
begin
  perform public.assert_admin();
  if v_name = '' or length(v_name) > 100 then
    raise exception 'Podaj nazwę urządzenia (do 100 znaków).' using errcode = '22023';
  end if;

  return query
  insert into public.devices as d (name, token_hash)
  values (v_name, encode(extensions.digest(v_token, 'sha256'), 'hex'))
  returning d.id, d.name, v_token;
end;
$$;

create function public.admin_revoke_device(p_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  update public.devices set revoked_at = coalesce(revoked_at, now()) where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Groups (group-tracking)
-- ---------------------------------------------------------------------------

create function public.admin_update_group(p_id uuid, p_tracked boolean, p_display_name text)
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
         display_name = nullif(btrim(coalesce(p_display_name, '')), '')
   where id = p_id
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Nie ma takiej grupy.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

revoke execute on function public.admin_create_device(text) from public, anon;
revoke execute on function public.admin_revoke_device(uuid) from public, anon;
revoke execute on function public.admin_update_group(uuid, boolean, text) from public, anon;
grant execute on function public.admin_create_device(text) to authenticated;
grant execute on function public.admin_revoke_device(uuid) to authenticated;
grant execute on function public.admin_update_group(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Source context (source-trace). security invoker: RLS decides what is visible.
-- ---------------------------------------------------------------------------

create function public.message_context(p_message_id uuid, p_before int default 10, p_after int default 10)
returns table (
  id uuid,
  group_id uuid,
  author text,
  sent_at timestamptz,
  text text,
  has_attachment boolean,
  status text
)
language sql stable security invoker
set search_path = ''
as $$
  with target as (
    select m.group_id, m.sent_at, m.id from public.messages m where m.id = p_message_id
  ),
  before_rows as (
    select m.* from public.messages m, target t
    where m.group_id = t.group_id and (m.sent_at, m.id) < (t.sent_at, t.id)
    order by m.sent_at desc, m.id desc
    limit least(greatest(p_before, 0), 200)
  ),
  after_rows as (
    select m.* from public.messages m, target t
    where m.group_id = t.group_id and (m.sent_at, m.id) > (t.sent_at, t.id)
    order by m.sent_at, m.id
    limit least(greatest(p_after, 0), 200)
  ),
  all_rows as (
    select * from before_rows
    union all
    select m.* from public.messages m where m.id = p_message_id
    union all
    select * from after_rows
  )
  select a.id, a.group_id, a.author, a.sent_at, a.text, a.has_attachment, a.status
  from all_rows a
  order by a.sent_at, a.id
$$;

revoke execute on function public.message_context(uuid, int, int) from public, anon;
grant execute on function public.message_context(uuid, int, int) to authenticated;
