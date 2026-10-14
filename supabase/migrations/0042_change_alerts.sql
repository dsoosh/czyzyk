-- Immediate alerts about new and changed events and new things to bring (change-alerts). A changed
-- event alerts once per recorded change (item_changes.id in ref); other kinds once per item.

alter table public.push_settings add column alert_events boolean not null default true;
alter table public.push_settings add column alert_bring_items boolean not null default true;

alter table public.push_alerts_sent drop constraint push_alerts_sent_kind_check;
alter table public.push_alerts_sent add constraint push_alerts_sent_kind_check
  check (kind in ('closure', 'action_required', 'payment_due', 'event_new', 'event_changed', 'bring_item_new'));
alter table public.push_alerts_sent add column ref text not null default '';
alter table public.push_alerts_sent drop constraint push_alerts_sent_pkey;
alter table public.push_alerts_sent add primary key (kind, item_id, ref);
