-- Message triage (message-triage): the cheap first look at a batch is an LLM call too.
alter table public.llm_calls drop constraint llm_calls_kind_check;
alter table public.llm_calls add constraint llm_calls_kind_check check (kind in ('extraction', 'document', 'triage'));

-- Which triage step skipped the message (shown in the group history); null once analysed.
alter table public.messages add column triage text check (triage in ('rules', 'model'));
