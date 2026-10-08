-- Merging adjacent closures (closure-ranges): active closures of the same group and reason on
-- consecutive days, or separated only by a weekend, become one closure from–to. The earliest
-- one is kept and extended; the others are cancelled. Both changes go to the item history.

do $$
declare
  r record;
  keep record;
  merged boolean;
  has_keep boolean := false;
  v_rationale constant text := 'Połączono sąsiednie dni wolne w jeden zakres.';
begin
  for r in
    select c.id, c.group_id, c.date_from, c.date_to, c.source_message_ids,
           regexp_replace(lower(btrim(coalesce(c.reason, ''))), '\s+', ' ', 'g') as reason_key
      from public.closures c
     where c.status = 'active'
     order by c.group_id nulls first, reason_key, c.date_from, c.date_to
  loop
    merged := false;
    if has_keep then
      merged := keep.group_id is not distinct from r.group_id
        and keep.reason_key = r.reason_key
        and not exists (
          select 1 from generate_series(keep.date_to + 1, r.date_from - 1, interval '1 day') d
           where extract(isodow from d) < 6
        );
    end if;
    if merged then
      if r.date_to > keep.date_to then
        insert into public.item_changes (item_type, item_id, op, changes, source_message_ids, rationale)
        values ('closure', keep.id, 'update',
                jsonb_build_object('date_to', jsonb_build_object('from', to_char(keep.date_to, 'YYYY-MM-DD'), 'to', to_char(r.date_to, 'YYYY-MM-DD'))),
                r.source_message_ids, v_rationale);
        keep.date_to := r.date_to;
      end if;
      update public.closures
         set date_to = keep.date_to,
             source_message_ids = array(select distinct unnest(source_message_ids || r.source_message_ids)),
             updated_at = now()
       where id = keep.id;
      update public.closures set status = 'cancelled', updated_at = now() where id = r.id;
      insert into public.item_changes (item_type, item_id, op, changes, source_message_ids, rationale)
      values ('closure', r.id, 'cancel', null, r.source_message_ids, v_rationale);
    else
      keep := r;
      has_keep := true;
    end if;
  end loop;
end
$$;
