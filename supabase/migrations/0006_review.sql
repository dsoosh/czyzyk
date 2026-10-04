-- Stage 3: admin review of extracted items (extraction-review).
-- reviewed_by/reviewed_at record the admin's decision; once set, the worker no
-- longer overwrites the item and stores its proposal in pending_patch instead.
-- Patches use the same field names as the extraction data (packages/shared
-- itemDataSchemas), so a proposal can be accepted as is.

do $$
declare
  t text;
begin
  foreach t in array array['events', 'bring_items', 'payments', 'action_required', 'closures', 'facts']
  loop
    execute format(
      'alter table public.%I
         add column reviewed_by uuid references public.profiles (id) on delete set null,
         add column reviewed_at timestamptz,
         add column pending_patch jsonb check (pending_patch is null or jsonb_typeof(pending_patch) = ''object'')',
      t
    );
    execute format(
      'create index %I on public.%I (updated_at) where status = ''needs_review'' or pending_patch is not null',
      t || '_review_idx', t
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Queue: items the model was unsure about, and proposals for reviewed items.
-- security_invoker keeps table RLS in force; the filter keeps it admin-only.
-- ---------------------------------------------------------------------------

create view public.review_queue with (security_invoker = true) as
select 'event'::text as kind, t.id, t.group_id, t.status, t.confidence, t.rationale, t.source_message_ids,
       t.pending_patch, t.reviewed_at, t.updated_at,
       jsonb_build_object(
         'title', t.title,
         'start', case when t.all_day then to_char(t.starts_at at time zone 'Europe/Warsaw', 'YYYY-MM-DD')
                       else to_char(t.starts_at at time zone 'Europe/Warsaw', 'YYYY-MM-DD"T"HH24:MI') end,
         'end', case when t.ends_at is null then null
                     when t.all_day then to_char(t.ends_at at time zone 'Europe/Warsaw', 'YYYY-MM-DD')
                     else to_char(t.ends_at at time zone 'Europe/Warsaw', 'YYYY-MM-DD"T"HH24:MI') end,
         'all_day', t.all_day,
         'location', t.location,
         'whole_kindergarten', t.group_id is null) as data
  from public.events t
 where (t.status = 'needs_review' or t.pending_patch is not null) and (select public.is_admin())
union all
select 'bring_item', t.id, t.group_id, t.status, t.confidence, t.rationale, t.source_message_ids,
       t.pending_patch, t.reviewed_at, t.updated_at,
       jsonb_build_object('description', t.description, 'due_date', to_char(t.due_date, 'YYYY-MM-DD'))
  from public.bring_items t
 where (t.status = 'needs_review' or t.pending_patch is not null) and (select public.is_admin())
union all
select 'payment', t.id, t.group_id, t.status, t.confidence, t.rationale, t.source_message_ids,
       t.pending_patch, t.reviewed_at, t.updated_at,
       jsonb_build_object('description', t.description, 'amount_pln', t.amount_pln::float8,
                          'due_date', to_char(t.due_date, 'YYYY-MM-DD'))
  from public.payments t
 where (t.status = 'needs_review' or t.pending_patch is not null) and (select public.is_admin())
union all
select 'action_required', t.id, t.group_id, t.status, t.confidence, t.rationale, t.source_message_ids,
       t.pending_patch, t.reviewed_at, t.updated_at,
       jsonb_build_object('question', t.question, 'due_date', to_char(t.due_date, 'YYYY-MM-DD'))
  from public.action_required t
 where (t.status = 'needs_review' or t.pending_patch is not null) and (select public.is_admin())
union all
select 'closure', t.id, t.group_id, t.status, t.confidence, t.rationale, t.source_message_ids,
       t.pending_patch, t.reviewed_at, t.updated_at,
       jsonb_build_object('date_from', to_char(t.date_from, 'YYYY-MM-DD'), 'date_to', to_char(t.date_to, 'YYYY-MM-DD'),
                          'reason', t.reason)
  from public.closures t
 where (t.status = 'needs_review' or t.pending_patch is not null) and (select public.is_admin())
union all
select 'fact', t.id, t.group_id, t.status, t.confidence, t.rationale, t.source_message_ids,
       t.pending_patch, t.reviewed_at, t.updated_at,
       jsonb_build_object('category', t.category, 'label', t.label, 'value', t.value)
  from public.facts t
 where (t.status = 'needs_review' or t.pending_patch is not null) and (select public.is_admin());

revoke all on public.review_queue from anon, public;
grant select on public.review_queue to authenticated;

-- ---------------------------------------------------------------------------
-- review_item(kind, id, action, patch)
--   approve  – status active, optional patch applied (a proposal's extra source
--              messages are kept when p_patch is the proposal's data)
--   reject   – status cancelled
--   dismiss  – drop the pending proposal, keep the item as it is
-- Every action records the admin and time and clears pending_patch.
-- ---------------------------------------------------------------------------

create function public.review_text(p_patch jsonb, p_key text, p_current text, p_required boolean)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v text;
begin
  if not (p_patch ? p_key) then
    return p_current;
  end if;
  v := nullif(btrim(p_patch ->> p_key), '');
  if v is null and p_required then
    raise exception 'Pole % nie może być puste.', p_key using errcode = '22023';
  end if;
  return v;
end;
$$;

revoke execute on function public.review_text(jsonb, text, text, boolean) from public, anon, authenticated;

create function public.review_item(p_kind text, p_id uuid, p_action text, p_patch jsonb default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  v_allowed text[];
  v_table text;
  v_extra_sources uuid[] := '{}';
  v_pending jsonb;
  v_all_day boolean;
  v_rows int;
  v_e public.events;
begin
  perform public.assert_admin();

  v_table := case p_kind
    when 'event' then 'events' when 'bring_item' then 'bring_items' when 'payment' then 'payments'
    when 'action_required' then 'action_required' when 'closure' then 'closures' when 'fact' then 'facts' end;
  if v_table is null then
    raise exception 'Nieznany typ elementu.' using errcode = '22023';
  end if;
  if p_action is null or p_action not in ('approve', 'reject', 'dismiss') then
    raise exception 'Nieznana decyzja.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_patch) <> 'object' or (p_action <> 'approve' and v_patch <> '{}'::jsonb) then
    raise exception 'Poprawki są możliwe tylko przy zatwierdzeniu.' using errcode = '22023';
  end if;

  v_allowed := case p_kind
    when 'event' then array['title', 'start', 'end', 'all_day', 'location', 'whole_kindergarten']
    when 'bring_item' then array['description', 'due_date']
    when 'payment' then array['description', 'amount_pln', 'due_date']
    when 'action_required' then array['question', 'due_date']
    when 'closure' then array['date_from', 'date_to', 'reason']
    when 'fact' then array['category', 'label', 'value'] end;
  if exists (select 1 from jsonb_object_keys(v_patch) k where k <> all (v_allowed)) then
    raise exception 'Niedozwolone pole w poprawce.' using errcode = '22023';
  end if;

  execute format('select pending_patch from public.%I where id = $1 for update', v_table) into v_pending using p_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Nie ma takiego elementu.' using errcode = 'P0002';
  end if;
  if p_action = 'dismiss' and v_pending is null then
    raise exception 'Ten element nie ma oczekującej propozycji.' using errcode = '22023';
  end if;
  -- Accepting a proposal keeps the messages it was based on.
  if p_action = 'approve' and v_pending is not null and jsonb_typeof(v_pending -> 'source_message_ids') = 'array' then
    select coalesce(array_agg(x::uuid), '{}') into v_extra_sources
      from jsonb_array_elements_text(v_pending -> 'source_message_ids') x;
  end if;

  execute format(
    'update public.%I
        set status = case $2 when ''approve'' then ''active'' when ''reject'' then ''cancelled'' else status end,
            reviewed_by = auth.uid(), reviewed_at = now(), pending_patch = null,
            source_message_ids = array(select distinct unnest(source_message_ids || $3))
      where id = $1',
    v_table
  ) using p_id, p_action, v_extra_sources;

  if p_action <> 'approve' or v_patch = '{}'::jsonb then
    return;
  end if;

  case p_kind
  when 'event' then
    select * into v_e from public.events where id = p_id;
    v_all_day := coalesce((v_patch ->> 'all_day')::boolean, v_e.all_day);
    update public.events t set
      title = public.review_text(v_patch, 'title', t.title, true),
      location = public.review_text(v_patch, 'location', t.location, false),
      all_day = v_all_day,
      starts_at = case when v_patch ? 'start' then
                    case when v_all_day then (left(v_patch ->> 'start', 10)::date)::timestamp at time zone 'Europe/Warsaw'
                         else (v_patch ->> 'start')::timestamp at time zone 'Europe/Warsaw' end
                  else t.starts_at end,
      ends_at = case when v_patch ? 'end' then
                  case when v_patch ->> 'end' is null then null
                       when v_all_day then (left(v_patch ->> 'end', 10)::date)::timestamp at time zone 'Europe/Warsaw'
                       else (v_patch ->> 'end')::timestamp at time zone 'Europe/Warsaw' end
                else t.ends_at end,
      group_id = case
                   when not (v_patch ? 'whole_kindergarten') then t.group_id
                   when (v_patch ->> 'whole_kindergarten')::boolean then null
                   else coalesce(t.group_id, (select m.group_id from public.messages m where m.id = t.source_message_ids[1]))
                 end
    where t.id = p_id;
  when 'bring_item' then
    update public.bring_items t set
      description = public.review_text(v_patch, 'description', t.description, true),
      due_date = case when v_patch ? 'due_date' then (v_patch ->> 'due_date')::date else t.due_date end
    where t.id = p_id;
  when 'payment' then
    update public.payments t set
      description = public.review_text(v_patch, 'description', t.description, true),
      amount_pln = case when v_patch ? 'amount_pln' then (v_patch ->> 'amount_pln')::numeric else t.amount_pln end,
      due_date = case when v_patch ? 'due_date' then (v_patch ->> 'due_date')::date else t.due_date end
    where t.id = p_id;
  when 'action_required' then
    update public.action_required t set
      question = public.review_text(v_patch, 'question', t.question, true),
      due_date = case when v_patch ? 'due_date' then (v_patch ->> 'due_date')::date else t.due_date end
    where t.id = p_id;
  when 'closure' then
    update public.closures t set
      date_from = case when v_patch ? 'date_from' then (v_patch ->> 'date_from')::date else t.date_from end,
      date_to = case when v_patch ? 'date_to' then (v_patch ->> 'date_to')::date else t.date_to end,
      reason = public.review_text(v_patch, 'reason', t.reason, false)
    where t.id = p_id;
  when 'fact' then
    update public.facts t set
      category = public.review_text(v_patch, 'category', t.category, true),
      label = public.review_text(v_patch, 'label', t.label, true),
      value = public.review_text(v_patch, 'value', t.value, true)
    where t.id = p_id;
  end case;
end;
$$;

revoke execute on function public.review_item(text, uuid, text, jsonb) from public, anon;
grant execute on function public.review_item(text, uuid, text, jsonb) to authenticated;
