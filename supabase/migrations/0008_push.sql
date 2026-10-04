-- Stage 3: Web Push (push-notifications). Subscriptions and settings are written
-- by services/api after verifying the user's Supabase session; services/cron reads
-- them with the server connection and sends the evening digest and alerts.

create table public.push_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  digest_enabled boolean not null default true,
  -- Local Europe/Warsaw time of the evening digest.
  digest_time time not null default '19:00' check (digest_time = date_trunc('minute', digest_time)),
  alert_closures boolean not null default true,
  alert_actions boolean not null default true,
  alert_payments boolean not null default true,
  -- Local date of the last digest decision (sent or skipped): at most one per day.
  digest_sent_on date,
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.push_settings
  for each row execute function public.set_updated_at();

-- One alert per item and kind, whatever number of extractions touch it.
create table public.push_alerts_sent (
  kind text not null check (kind in ('closure', 'action_required', 'payment_due')),
  item_id uuid not null,
  sent_at timestamptz not null default now(),
  primary key (kind, item_id)
);

alter table public.push_settings enable row level security;
alter table public.push_alerts_sent enable row level security;

create policy owner_read on public.push_settings for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_family()));
create policy admin_read on public.push_alerts_sent for select to authenticated
  using ((select public.is_admin()));

revoke all on public.push_settings, public.push_alerts_sent from anon;
revoke insert, update, delete, truncate on public.push_settings, public.push_alerts_sent from authenticated;
