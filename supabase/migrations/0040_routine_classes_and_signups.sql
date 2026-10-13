-- Routine classes and sign-ups (event-plan): weekly classes held during kindergarten hours
-- (English, Spanish) need nothing from parents, so the calendar, lists, digests and the calendar
-- feed leave them out; an action can be a sign-up or a survey.
alter table public.events add column in_hours boolean not null default false;
alter table public.action_required add column kind text check (kind in ('signup', 'survey'));

-- The family views expose the new action column.
drop view public.family_action_required;
create view public.family_action_required with (security_invoker = true) as
select t.*, d.done_by as resolved_by, d.done_at as resolved_at, d.resolution
  from public.action_required t
  left join public.item_done d on d.item_type = 'action_required' and d.item_id = t.id and d.family_id = (select public.my_family());
revoke all on public.family_action_required from anon, public;
grant select on public.family_action_required to authenticated;
