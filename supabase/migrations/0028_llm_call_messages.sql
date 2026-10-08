-- Which messages a model call was about (llm-call-log): the chat view links a message to the
-- triage verdict and the analysis it went through. Readable by admins only, like the log.

alter table public.llm_calls add column message_ids uuid[] not null default '{}';
create index llm_calls_message_ids_idx on public.llm_calls using gin (message_ids);
