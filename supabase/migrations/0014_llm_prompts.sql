-- Admin-edited LLM prompt templates (llm-prompts). A row overrides the default template
-- kept in code (@czyzyk/shared/prompts); no row = default. Templates may only use the
-- placeholders the prompt offers; the services fill them with trusted family data and
-- always append the fixed security rules.

create table public.llm_prompts (
  key text primary key check (key in ('extraction', 'assistant')),
  template text not null check (char_length(btrim(template)) between 1 and 20000),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.llm_prompts enable row level security;
create policy admin_read on public.llm_prompts for select to authenticated using ((select public.is_admin()));
revoke all on public.llm_prompts from anon;
revoke insert, update, delete, truncate on public.llm_prompts from authenticated;

-- Placeholders each prompt offers; must match PROMPT_PLACEHOLDERS in @czyzyk/shared.
create function public.llm_prompt_placeholders(p_key text)
returns text[]
language sql immutable
set search_path = ''
as $$
  select case p_key
    when 'extraction' then array['przedszkole', 'dzieci', 'rodzina']
    when 'assistant' then array['przedszkole', 'dzieci', 'rodzina', 'uzytkownik']
  end;
$$;

-- Saves a template, or restores the default when p_template is null or blank.
create function public.admin_save_llm_prompt(p_key text, p_template text)
returns public.llm_prompts
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.llm_prompts;
  v_unknown text;
begin
  perform public.assert_admin();
  if public.llm_prompt_placeholders(p_key) is null then
    raise exception 'Nie ma takiego promptu.' using errcode = 'P0002';
  end if;
  if p_template is null or btrim(p_template) = '' then
    delete from public.llm_prompts where key = p_key;
    return null;
  end if;
  select m[1] into v_unknown
    from regexp_matches(p_template, '\{\{\s*([^{}]*?)\s*\}\}', 'g') as m
   where not (m[1] = any(public.llm_prompt_placeholders(p_key)))
   limit 1;
  if v_unknown is not null then
    raise exception 'Nieznany placeholder {{%}}.', v_unknown using errcode = '22023';
  end if;
  insert into public.llm_prompts (key, template, updated_by, updated_at)
    values (p_key, btrim(p_template), auth.uid(), now())
  on conflict (key) do update
    set template = excluded.template, updated_by = excluded.updated_by, updated_at = excluded.updated_at
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.llm_prompt_placeholders(text) from public, anon;
revoke execute on function public.admin_save_llm_prompt(text, text) from public, anon;
grant execute on function public.admin_save_llm_prompt(text, text) to authenticated;
