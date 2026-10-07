-- History of item changes made by the extraction (item-history): each create, update and
-- cancel with the changed fields (before → after), the source messages and the rationale.
-- Readable by the family like the items themselves; written only by the worker.

create table public.item_changes (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('event', 'bring_item', 'payment', 'action_required', 'closure', 'fact')),
  item_id uuid not null,
  op text not null check (op in ('create', 'update', 'cancel')),
  -- create: the data; update: {field: {from, to}} of changed fields; cancel: null.
  changes jsonb,
  source_message_ids uuid[] not null default '{}',
  rationale text,
  created_at timestamptz not null default now()
);
create index item_changes_item_idx on public.item_changes (item_type, item_id, created_at);

alter table public.item_changes enable row level security;
create policy family_read on public.item_changes for select to authenticated using ((select public.is_family()));
revoke all on public.item_changes from anon;
revoke insert, update, delete, truncate on public.item_changes from authenticated;
