-- Event plan (event-plan): where and until when a child can be brought on the day of an event, and
-- the event's plan for the day, both written by the extraction.
alter table public.events
  add column drop_offs jsonb not null default '[]' check (jsonb_typeof(drop_offs) = 'array'),
  add column schedule jsonb not null default '[]' check (jsonb_typeof(schedule) = 'array');
