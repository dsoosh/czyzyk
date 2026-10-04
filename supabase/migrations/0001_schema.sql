-- Base schema: the full data model from docs/specyfikacja.md (without photo albums,
-- see the 2026-10-04 decision), row level security on every table, and the
-- is_family()/is_admin() helpers. Clients only ever read; writes go through
-- server services (service_role) or narrow security definer RPCs.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Access control tables
-- ---------------------------------------------------------------------------

create table public.allowed_emails (
  email text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
  role text not null check (role in ('admin', 'family')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Deleting an allowed email deletes the profile, which revokes access immediately.
  email text not null unique references public.allowed_emails (email) on delete cascade,
  display_name text,
  role text not null check (role in ('admin', 'family')),
  created_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

-- ---------------------------------------------------------------------------
-- WhatsApp data
-- ---------------------------------------------------------------------------

create table public.wa_groups (
  id uuid primary key default gen_random_uuid(),
  wa_name text not null unique,
  display_name text,
  tracked boolean not null default false,
  last_export_at timestamptz,
  last_notification_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.wa_groups (id) on delete cascade,
  author text not null,
  sent_at timestamptz not null,
  text text not null default '',
  source text not null check (source in ('notification', 'export')),
  dedupe_key text not null,
  has_attachment boolean not null default false,
  status text not null default 'active' check (status in ('active', 'deleted_suspected')),
  processed_at timestamptz,
  embedding extensions.vector(1024),
  created_at timestamptz not null default now(),
  unique (group_id, dedupe_key)
);
create index messages_group_sent_idx on public.messages (group_id, sent_at desc);
create index messages_unprocessed_idx on public.messages (group_id) where processed_at is null;

-- Attachments are documents only: photos of people never leave the phone.
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  storage_path text,
  thumb_path text,
  mime text,
  caption text,
  created_at timestamptz not null default now()
);
create index attachments_message_idx on public.attachments (message_id);

-- ---------------------------------------------------------------------------
-- Items extracted by the LLM. All share provenance and review columns.
-- group_id null means "the whole kindergarten".
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.wa_groups (id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  source_message_ids uuid[] not null default '{}',
  confidence real check (confidence between 0 and 1),
  rationale text,
  status text not null default 'active' check (status in ('active', 'needs_review', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index events_starts_idx on public.events (starts_at) where status = 'active';

create table public.bring_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.wa_groups (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  description text not null,
  due_date date,
  packed_by uuid references public.profiles (id) on delete set null,
  packed_at timestamptz,
  source_message_ids uuid[] not null default '{}',
  confidence real check (confidence between 0 and 1),
  rationale text,
  status text not null default 'active' check (status in ('active', 'needs_review', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bring_items_due_idx on public.bring_items (due_date) where status = 'active';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.wa_groups (id) on delete set null,
  description text not null,
  amount_pln numeric(10, 2) check (amount_pln is null or amount_pln >= 0),
  due_date date,
  paid_by uuid references public.profiles (id) on delete set null,
  paid_at timestamptz,
  source_message_ids uuid[] not null default '{}',
  confidence real check (confidence between 0 and 1),
  rationale text,
  status text not null default 'active' check (status in ('active', 'needs_review', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.action_required (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.wa_groups (id) on delete set null,
  question text not null,
  due_date date,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  source_message_ids uuid[] not null default '{}',
  confidence real check (confidence between 0 and 1),
  rationale text,
  status text not null default 'active' check (status in ('active', 'needs_review', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.closures (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.wa_groups (id) on delete set null,
  date_from date not null,
  date_to date not null,
  reason text,
  source_message_ids uuid[] not null default '{}',
  confidence real check (confidence between 0 and 1),
  rationale text,
  status text not null default 'active' check (status in ('active', 'needs_review', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_to >= date_from)
);

create table public.facts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.wa_groups (id) on delete set null,
  category text not null check (category in ('godziny', 'kontakt', 'osoba', 'inne')),
  label text not null,
  value text not null,
  source_message_ids uuid[] not null default '{}',
  confidence real check (confidence between 0 and 1),
  rationale text,
  status text not null default 'active' check (status in ('active', 'needs_review', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Per-user data
-- ---------------------------------------------------------------------------

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  cited_message_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index chat_messages_thread_idx on public.chat_messages (thread_id, created_at);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.ical_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.sync_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('notification', 'export', 'extraction')),
  status text not null,
  error_step text,
  wa_version text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index sync_log_created_idx on public.sync_log (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['events', 'bring_items', 'payments', 'action_required', 'closures', 'facts', 'chat_threads']
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

create function public.is_family() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid())
$$;

create function public.is_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

revoke execute on function public.is_family() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_family() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

-- Clients never write tables directly, and anonymous clients never read anything.
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'allowed_emails', 'profiles', 'devices', 'wa_groups', 'messages', 'attachments',
    'events', 'bring_items', 'payments', 'action_required', 'closures', 'facts',
    'chat_threads', 'chat_messages', 'push_subscriptions', 'ical_tokens', 'sync_log'
  ]
  loop
    -- Not FORCEd: the table owner (migrations, security definer helpers) must bypass RLS,
    -- otherwise is_family() reading profiles would recurse into its own policy.
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- Domain data: readable by every family member.
  foreach t in array array[
    'profiles', 'wa_groups', 'messages', 'attachments',
    'events', 'bring_items', 'payments', 'action_required', 'closures', 'facts'
  ]
  loop
    execute format(
      'create policy family_read on public.%I for select to authenticated using ((select public.is_family()))',
      t
    );
  end loop;

  -- Administrative data: admins only.
  foreach t in array array['allowed_emails', 'devices', 'sync_log']
  loop
    execute format(
      'create policy admin_read on public.%I for select to authenticated using ((select public.is_admin()))',
      t
    );
  end loop;

  -- Private per-user data: the owner only, and only while still in the family.
  foreach t in array array['chat_threads', 'chat_messages', 'push_subscriptions', 'ical_tokens']
  loop
    execute format(
      'create policy owner_read on public.%I for select to authenticated using (user_id = (select auth.uid()) and (select public.is_family()))',
      t
    );
  end loop;
end
$$;
