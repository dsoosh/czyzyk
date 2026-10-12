-- What the worker did with the model's answer (llm-call-log): counts and rejected operations with
-- their reasons, so the admin sees when an operation from the answer was not applied.
alter table public.llm_calls add column outcome jsonb;

-- Children shown on an item (families): the family views gain the columns added after them
-- (audience, extra_group_ids, legacy_audience), so the PWA can show children of joined groups.
drop view public.family_bring_items;
drop view public.family_payments;
drop view public.family_action_required;

create view public.family_bring_items with (security_invoker = true) as
select t.*, d.done_by as packed_by, d.done_at as packed_at
  from public.bring_items t
  left join public.item_done d on d.item_type = 'bring_item' and d.item_id = t.id and d.family_id = (select public.my_family());

create view public.family_payments with (security_invoker = true) as
select t.*, d.done_by as paid_by, d.done_at as paid_at
  from public.payments t
  left join public.item_done d on d.item_type = 'payment' and d.item_id = t.id and d.family_id = (select public.my_family());

create view public.family_action_required with (security_invoker = true) as
select t.*, d.done_by as resolved_by, d.done_at as resolved_at, d.resolution
  from public.action_required t
  left join public.item_done d on d.item_type = 'action_required' and d.item_id = t.id and d.family_id = (select public.my_family());

revoke all on public.family_bring_items, public.family_payments, public.family_action_required from anon, public;
grant select on public.family_bring_items, public.family_payments, public.family_action_required to authenticated;

-- Whole-group items (no audience) keep no stale assignment: old items listed the operator's
-- children even for whole-group announcements, so they showed only that child.
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
    execute format($sql$update public.%I set child_ids = '{}' where cardinality(audience) = 0 and cardinality(child_ids) > 0$sql$, t);
  end loop;
end;
$$;

select public.refresh_item_children();
