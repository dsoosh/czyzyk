# Tasks

## 1. Baza

- [x] 1.1 Migracja `0033_audience.sql`:
  - `audience` i `extra_group_ids` na sprawach;
  - `audience_children`, `refresh_item_children`, `family_sees_item`;
  - RLS i RPC (`item_visible`, `apply_action_suggestion`, `save_child`, `delete_child`);
  - weryfikacja: `supabase/tests/audience.test.ts`.

## 2. Analiza

- [x] 2.1 Kontrakt i prompt: `done`, adresaci, stałe zasady o rodzinach, blok `<rodziny>`, znaczniki `[rodzina Rn]` i `[do Rn]`; weryfikacja: testy shared, snapshot promptu.
- [x] 2.2 Worker: zapis adresatów, `join` z dodatkową grupą, `done` dla rodziny, przeliczenie przypisań; weryfikacja: `run.db.test.ts`.
- [x] 2.3 Skróty i alerty według widoczności sprawy dla rodziny; weryfikacja: `cron.db.test.ts`.

## 3. Sprawdzenie

- [ ] 3.1 `npm run spec:validate`, typecheck, wszystkie testy.
- [ ] 3.2 Analiza po wdrożeniu przypisuje dzieci jak dotąd; weryfikacja: użytkownik.
