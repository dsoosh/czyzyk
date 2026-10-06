-- Realtime extraction (item-extraction): every new unprocessed message wakes the
-- worker, which listens on channel message_ingested. The payload is the group id
-- only, never message content. Identical notifications within one transaction are
-- folded by Postgres, so a chat import sends one notification per group.

create function public.notify_message_ingested()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_notify('message_ingested', new.group_id::text);
  return null;
end;
$$;

revoke all on function public.notify_message_ingested() from public, anon, authenticated;

create trigger messages_notify_ingested
  after insert on public.messages
  for each row
  when (new.processed_at is null and new.status = 'active')
  execute function public.notify_message_ingested();
