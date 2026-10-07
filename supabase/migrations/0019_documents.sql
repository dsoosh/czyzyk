-- Documents from shared chat exports (document-import). The phone screens every image and
-- sends only organisational documents: an image without people (screening 'image') or just
-- the text read on the phone ('text_only'). Photos of people never reach the server.

alter table public.attachments
  add column file_name text,
  add column screening text check (screening in ('image', 'text_only')),
  add column doc_text text check (char_length(doc_text) <= 20000),
  add column description text check (char_length(description) <= 2000),
  add column sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  -- pending: waits for the server-side check before extraction; ready: text usable by extraction.
  add column doc_status text check (doc_status in ('pending', 'ready'));

create unique index attachments_message_file_idx on public.attachments (message_id, file_name) where file_name is not null;
create unique index attachments_sha256_idx on public.attachments (sha256) where sha256 is not null;
create index attachments_pending_idx on public.attachments (doc_status) where doc_status = 'pending';

-- Document images. Server only: RLS without policies and no grants for the API roles.
create table public.attachment_files (
  attachment_id uuid primary key references public.attachments (id) on delete cascade,
  mime text not null check (mime = 'image/jpeg'),
  bytes bytea not null check (octet_length(bytes) between 1 and 2097152),
  created_at timestamptz not null default now()
);

alter table public.attachment_files enable row level security;
revoke all on public.attachment_files from anon, authenticated;

alter table public.sync_log drop constraint sync_log_kind_check;
alter table public.sync_log add constraint sync_log_kind_check check (kind in ('notification', 'export', 'extraction', 'document'));
