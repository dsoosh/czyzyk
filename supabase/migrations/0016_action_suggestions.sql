-- Suggested actions on "wymaga odpowiedzi" items (action-suggestions). Extraction stores
-- 1–4 suggestions fitting the item; a family member picks one and the database carries it
-- out: moves the item to things to bring / payments / the calendar, or records an answer.

alter table public.action_required
  add column suggested_actions jsonb not null default '[]'
    check (jsonb_typeof(suggested_actions) = 'array' and jsonb_array_length(suggested_actions) <= 4),
  -- What closed the item: the chosen suggestion's label ("Tak, zapisujemy", "Do przyniesienia").
  add column resolution text check (resolution is null or char_length(resolution) <= 60);

-- Undoing "resolved" also clears how it was resolved.
create or replace function public.mark_resolved(p_id uuid, p_done boolean)
returns public.action_required
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.action_required;
begin
  if not public.is_family() then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  update public.action_required
     set resolved_by = case when p_done then auth.uid() end,
         resolved_at = case when p_done then now() end,
         resolution = case when p_done then resolution end
   where id = p_id and status <> 'cancelled'
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Nie ma takiej sprawy.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- Applies suggestion number p_index (0-based) of an open item. Returns the kind and the id
-- of the item created from it (null for answer/done/not_applicable).
create function public.apply_action_suggestion(p_id uuid, p_index integer)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.action_required;
  v_s jsonb;
  v_kind text;
  v_label text;
  v_description text;
  v_due date;
  v_created uuid;
  v_note text;
begin
  if not public.is_family() then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  select * into v_row from public.action_required
   where id = p_id and status = 'active' and resolved_at is null
   for update;
  if v_row.id is null then
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

  case v_kind
    when 'bring' then
      insert into public.bring_items (group_id, description, due_date, child_ids, source_message_ids, confidence, rationale)
        values (v_row.group_id, v_description, v_due, v_row.child_ids, v_row.source_message_ids, v_row.confidence, v_note)
        returning id into v_created;
    when 'payment' then
      insert into public.payments (group_id, description, amount_pln, due_date, child_ids, source_message_ids, confidence, rationale)
        values (v_row.group_id, v_description, (v_s ->> 'amount_pln')::numeric, v_due, v_row.child_ids, v_row.source_message_ids,
                v_row.confidence, v_note)
        returning id into v_created;
    when 'event' then
      if v_due is null then
        raise exception 'Akcja nie ma daty wydarzenia.' using errcode = '22023';
      end if;
      insert into public.events (group_id, title, starts_at, all_day, child_ids, source_message_ids, confidence, rationale)
        values (v_row.group_id, v_description, v_due::timestamp at time zone 'Europe/Warsaw', true, v_row.child_ids,
                v_row.source_message_ids, v_row.confidence, v_note)
        returning id into v_created;
    when 'answer', 'done', 'not_applicable' then
      null;
    else
      raise exception 'Nieznana akcja.' using errcode = '22023';
  end case;

  update public.action_required
     set resolved_by = auth.uid(), resolved_at = now(), resolution = v_label
   where id = p_id;
  return jsonb_build_object('kind', v_kind, 'created_id', v_created);
end;
$$;

revoke execute on function public.apply_action_suggestion(uuid, integer) from public, anon;
grant execute on function public.apply_action_suggestion(uuid, integer) to authenticated;
