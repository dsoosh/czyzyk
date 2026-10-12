# Tasks

## 1. Baza i worker

- [x] 1.1 Migracja `0038_llm_call_outcome.sql` (kolumna `outcome`, widoki rodziny, `refresh_item_children`); weryfikacja: `legacy-item-audience.test.ts`.
- [x] 1.2 `join` i `update` wyłączają `legacy_audience`, wynik zapisu w dzienniku, kontekst bez `suggestions`; weryfikacja: `run.db.test.ts`.

## 2. Prompt i PWA

- [x] 2.1 Prompt bez `suggestions`; weryfikacja: snapshot `prompt.test.ts`.
- [x] 2.2 „Oznacz jako wykonane”, dzieci grup dołączonych, „Kopiuj całość”; weryfikacja: `Resolve.test.tsx`, `LlmCalls.test.tsx`.

- [x] 2.3 Poprawka: dni wolne bez `extra_group_ids` w liście kolumn PWA; weryfikacja: `supabase/tests/pwa-columns.test.ts` (kolumny PWA na prawdziwym schemacie).

## 3. Sprawdzenie

- [x] 3.1 `npm run spec:validate`, typecheck, wszystkie testy.
- [ ] 3.2 Dziecko dołączone z innej grupy widać przy wydarzeniu; weryfikacja: użytkownik.
