-- A thing to bring created from a "wymaga odpowiedzi" item (action-suggestions) gets the
-- next school day when the item's date has passed or is missing; the result reports the date.

create or replace function public.apply_action_suggestion(p_id uuid, p_index integer)
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
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
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

  -- Picked now, so a thing to bring with a past or missing date is for the next school day
  -- (otherwise it lands in the past and never shows on the home screen).
  if v_kind = 'bring' and (v_due is null or v_due < v_today) then
    v_due := v_today + case extract(isodow from v_today) when 5 then 3 when 6 then 2 else 1 end;
  end if;

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
  return jsonb_build_object('kind', v_kind, 'created_id', v_created, 'due_date', case when v_created is not null then v_due end);
end;
$$;

