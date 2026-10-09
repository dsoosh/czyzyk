# Tasks

## 1. Baza

- [x] 1.1 Migracja `0032_families.sql`:
  - `families`, `family_id`, `wa_groups.shared`;
  - funkcje widoczności, polityki RLS;
  - `item_done` i widoki `family_*`;
  - RPC: znaczniki, akcje, dzieci, grupy, `trackable_groups`, `attachment_image`;
  - weryfikacja: `supabase/tests/families.test.ts` oraz dotychczasowe testy `supabase/tests`.

## 2. PWA

- [x] 2.1 Elementy przez widoki `family_*`, wybór grupy dziecka przez `trackable_groups`, checkbox „Wspólna”; weryfikacja: testy PWA.

## 3. Serwer

- [x] 3.1 Skróty i alerty per rodzina, kontekst analizy bez stanu wykonania; weryfikacja: `cron.db.test.ts`, `run.db.test.ts`.
- [x] 3.2 iCal i asystent per rodzina; weryfikacja: testy API.

## 4. Sprawdzenie

- [x] 4.1 `npm run spec:validate`, typecheck, wszystkie testy.
- [ ] 4.2 Po wdrożeniu aplikacja działa jak dotąd; weryfikacja: użytkownik.
