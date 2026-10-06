-- Description of the kindergarten (kindergarten-profile): one free-text row the admin
-- edits in the PWA. Extraction and the view assistant read it as context from the family.

create table public.kindergarten_profile (
  id boolean primary key default true check (id),
  content text not null default '' check (char_length(content) <= 8000),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.kindergarten_profile enable row level security;
create policy family_read on public.kindergarten_profile for select to authenticated using ((select public.is_family()));
revoke all on public.kindergarten_profile from anon;
revoke insert, update, delete, truncate on public.kindergarten_profile from authenticated;

create function public.admin_update_kindergarten_profile(p_content text)
returns public.kindergarten_profile
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.kindergarten_profile;
begin
  perform public.assert_admin();
  insert into public.kindergarten_profile (id, content, updated_by, updated_at)
  values (true, btrim(coalesce(p_content, '')), auth.uid(), now())
  on conflict (id) do update
    set content = excluded.content, updated_by = excluded.updated_by, updated_at = excluded.updated_at
  returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.admin_update_kindergarten_profile(text) from public, anon;
grant execute on function public.admin_update_kindergarten_profile(text) to authenticated;

-- Starting description, provided by the family (and the kindergarten's public listing).
insert into public.kindergarten_profile (content) values ($profile$Placówka: Leśne Przedszkole i Leśna Klasa „Cztery Żywioły” (Leśna Baza Cztery Żywioły), prowadzone przez Fundację Gaj. Pedagogika inspirowana Montessori i Waldorfem; dzieci dużo czasu spędzają na dworze, niezależnie od pogody.

Miejsca:
- „Baza” – główna siedziba przedszkola i leśnej klasy: Golędzinów, Kolonia 39 (gmina Oborniki Śląskie). Czynna pon.–pt. 7:00–17:00.
- Lokal fundacji przy ul. Witosa 7 w Obornikach Śląskich.
- Lokal w Pęgowie, w budynku żłobka Kids Dream.

Prowadzący: fundację prowadzą Justyna Nowak i Monika Zielinska. Każda grupa ma jedną lub dwie opiekunki („ciocie”).

Grupy (projekt się rozwija, kolejne klasy są w przygotowaniu):
- Kotki – 3–4 lata (przedszkole)
- Sokoły – 5 lat (przedszkole)
- Puchacze – 6 lat (przedszkole)
- Sowy – 7 lat, 1 klasa
- Rysie – 8 lat, 2 klasa
- Wilki – 3 klasa
- Lisy – 4 klasa

Kanały WhatsApp: grupy poszczególnych grup/klas, kanały z wydarzeniami pozabazowymi (poza Bazą), grupa zrzeszająca rodziców w fundacji oraz grupa ogólna.$profile$);
