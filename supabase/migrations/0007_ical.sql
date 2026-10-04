-- Stage 3: private iCal subscription links (calendar-subscription).
-- One active token per user; the token is returned once and stored as sha256.
-- Deleting a family member's allowed email deletes the profile and, by cascade,
-- their tokens, so the feed stops working.

create function public.create_ical_token() returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not public.is_family() then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  update public.ical_tokens set revoked_at = now() where user_id = auth.uid() and revoked_at is null;
  insert into public.ical_tokens (user_id, token_hash)
  values (auth.uid(), encode(extensions.digest(v_token, 'sha256'), 'hex'));
  return v_token;
end;
$$;

create function public.revoke_ical_token() returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_family() then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  update public.ical_tokens set revoked_at = now() where user_id = auth.uid() and revoked_at is null;
end;
$$;

create unique index ical_tokens_one_active_idx on public.ical_tokens (user_id) where revoked_at is null;

revoke execute on function public.create_ical_token() from public, anon;
revoke execute on function public.revoke_ical_token() from public, anon;
grant execute on function public.create_ical_token() to authenticated;
grant execute on function public.revoke_ical_token() to authenticated;
