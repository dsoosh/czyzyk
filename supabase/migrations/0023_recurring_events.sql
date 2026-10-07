-- Recurring events (recurring-events): "basen w każdy wtorek" is one event repeating on ISO
-- weekdays (1 = Monday … 7 = Sunday) until an optional date. starts_at/ends_at hold the first
-- occurrence (time of day and duration). Occurrences on closure days are skipped.

alter table public.events
  add column repeat_weekdays smallint[] check (
    repeat_weekdays is null
    or (cardinality(repeat_weekdays) between 1 and 7 and repeat_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[])
  ),
  add column repeat_until date;

-- Occurrences of events between two local days (inclusive), as the caller
-- sees them (security invoker: RLS applies). One-off events appear once, recurring ones on
-- each matching weekday except closure days of their group or the whole kindergarten.
create function public.event_occurrences(p_from date, p_to date)
returns table (id uuid, starts_at timestamptz, ends_at timestamptz)
language sql stable security invoker
set search_path = ''
as $$
  select e.id, e.starts_at, e.ends_at
    from public.events e
   where e.repeat_weekdays is null
     -- Overlapping the range: a several-day event that started earlier is still on.
     and e.starts_at < (p_to + 1)::timestamp at time zone 'Europe/Warsaw'
     and coalesce(e.ends_at, e.starts_at) >= p_from::timestamp at time zone 'Europe/Warsaw'
  union all
  select e.id,
         (d.day + (e.starts_at at time zone 'Europe/Warsaw')::time) at time zone 'Europe/Warsaw',
         ((d.day + (e.starts_at at time zone 'Europe/Warsaw')::time) at time zone 'Europe/Warsaw') + (e.ends_at - e.starts_at)
    from public.events e
   cross join lateral (
     select g::date as day
       from generate_series(
              greatest(p_from, (e.starts_at at time zone 'Europe/Warsaw')::date),
              least(p_to, coalesce(e.repeat_until, p_to), p_from + 400),
              interval '1 day') g
   ) d
   where e.repeat_weekdays is not null
     and extract(isodow from d.day)::smallint = any(e.repeat_weekdays)
     and not exists (
       select 1 from public.closures c
        where c.status = 'active' and d.day between c.date_from and c.date_to
          and (c.group_id is null or c.group_id = e.group_id)
     )
$$;

revoke execute on function public.event_occurrences(date, date) from public, anon;
grant execute on function public.event_occurrences(date, date) to authenticated, service_role;
