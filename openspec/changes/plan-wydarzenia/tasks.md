# Tasks

## 1. Baza i analiza

- [x] 1.1 Migracja `0039_event_plan.sql`, kontrakt `drop_offs`/`schedule`, reguła 20 promptu, zapis i kontekst w workerze; weryfikacja: `run.db.test.ts`, snapshot `prompt.test.ts`.

## 2. PWA

- [x] 2.1 Podgląd wydarzenia: „Przyprowadzenie” i timeline „Plan dnia”; kalendarz i „Dziś”; weryfikacja: `CalendarPage.test.tsx`.

## 3. Skróty i asystent

- [x] 3.1 Przyprowadzenie w skrótach push, przyprowadzenie i plan dnia w kontekście asystenta; weryfikacja: `format.test.ts`.

## 4. Sprawdzenie

- [x] 4.1 `npm run spec:validate`, typecheck, build, wszystkie testy.
- [ ] 4.2 Wiadomość o wycieczce do Muzeum Współczesnego daje przyprowadzenie i plan dnia; weryfikacja: użytkownik.
