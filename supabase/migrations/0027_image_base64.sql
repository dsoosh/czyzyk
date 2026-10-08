-- encode(..., 'base64') breaks lines every 76 characters; data URLs and model APIs want one
-- line (document-import, event-history). Same function as 0025, without the line breaks.

create or replace function public.attachment_image(p_attachment_id uuid)
returns table (mime text, data text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_family() then
    raise exception 'Brak dostępu.' using errcode = '42501';
  end if;
  return query
    select f.mime, translate(encode(f.bytes, 'base64'), E'\n', '')
      from public.attachment_files f
      join public.attachments a on a.id = f.attachment_id
     where f.attachment_id = p_attachment_id and a.doc_status = 'ready';
end;
$$;
