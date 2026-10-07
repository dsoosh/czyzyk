-- Log of LLM calls made by the extraction worker (llm-call-log). Holds message content, so
-- only admins read it (family data stays within the family); server logs stay content-free.
-- Assistant conversations are private to their owner and never logged here.

create table public.llm_calls (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('extraction')),
  group_id uuid references public.wa_groups (id) on delete set null,
  model text,
  request jsonb not null,
  response jsonb,
  error text,
  usage jsonb,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index llm_calls_created_idx on public.llm_calls (created_at desc);

alter table public.llm_calls enable row level security;
create policy admin_read on public.llm_calls for select to authenticated using ((select public.is_admin()));
revoke all on public.llm_calls from anon;
revoke insert, update, delete, truncate on public.llm_calls from authenticated;
