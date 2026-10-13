# Tasks

## 1. Analiza

- [x] 1.1 `create` → `join` dla tego samego wydarzenia innej grupy, uzupełnienie planu, notatki w dzienniku; weryfikacja: `run.db.test.ts`.
- [x] 1.2 Pomijanie nadmiarowych pól; weryfikacja: `extraction.test.ts`.
- [x] 1.3 Zasada w stałej części promptu; weryfikacja: snapshot `prompt.test.ts`.

- [x] 1.4 Płatności wydarzeń: `0041_payment_event.sql`, pole `event`, strona wydarzenia; weryfikacja: `run.db.test.ts`, `CalendarPage.test.tsx`.

## 2. Sprawdzenie

- [x] 2.1 `npm run spec:validate`, typecheck, wszystkie testy.
- [ ] 2.2 Wklejone ogłoszenie z innej grupy nie tworzy duplikatu; weryfikacja: użytkownik.
