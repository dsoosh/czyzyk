-- Payments of an event (event-plan): a trip's fee points at the trip, like things to bring.
alter table public.payments add column event_id uuid references public.events (id) on delete set null;

-- The family view exposes the new column.
drop view public.family_payments;
create view public.family_payments with (security_invoker = true) as
select t.*, d.done_by as paid_by, d.done_at as paid_at
  from public.payments t
  left join public.item_done d on d.item_type = 'payment' and d.item_id = t.id and d.family_id = (select public.my_family());
revoke all on public.family_payments from anon, public;
grant select on public.family_payments to authenticated;
