-- Event history (event-history): the event page shows the document images attached to the
-- messages behind an event. Images stay in attachment_files (no direct access for the API
-- roles); a family member reads one image at a time through this function.

create function public.attachment_image(p_attachment_id uuid)
returns table (mime text, data text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_family() then
    raise exception 'Brak dostępu.' using errcode = '42501';
  end if;
  return query
    select f.mime, encode(f.bytes, 'base64')
      from public.attachment_files f
      join public.attachments a on a.id = f.attachment_id
     where f.attachment_id = p_attachment_id and a.doc_status = 'ready';
end;
$$;

revoke execute on function public.attachment_image(uuid) from public, anon;
grant execute on function public.attachment_image(uuid) to authenticated;
