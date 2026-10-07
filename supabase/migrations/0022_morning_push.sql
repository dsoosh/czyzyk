-- Morning digest and deadline reminders (morning-push): a push at the user's morning hour
-- with today's plan, and one with payments and answers due today or tomorrow.
alter table public.push_settings
  add column morning_enabled boolean not null default true,
  add column morning_time time not null default '06:45' check (morning_time = date_trunc('minute', morning_time)),
  add column morning_sent_on date,
  add column reminders_enabled boolean not null default true,
  add column reminders_sent_on date;
