# Tasks

## 1. Dane i analiza

- [x] 1.1 Migracja `0030_event_meeting_point`, pole `meeting_point` w kontrakcie, opisy pól, zasada 19, oba pola w danych istniejących elementów; weryfikacja: `run.db.test.ts` (zbiórka zachowana przy zmianie terminu), snapshot promptu

## 2. Widoki i powiadomienia

- [x] 2.1 Strona wydarzenia (link „Mapa”), „Dziś”, kalendarz, historia zmian; weryfikacja: `CalendarPage.test.tsx`, `TodayPage.test.tsx`
- [x] 2.2 Skróty i asystent; weryfikacja: `format.test.ts`, `cron.db.test.ts`

## 3. Sprawdzenie

- [x] 3.1 `npm run spec:validate`, typecheck, testy jednostkowe, PWA i bazodanowe
- [ ] 3.2 Nowa wiadomość o wycieczce daje miejsce i zbiórkę w aplikacji; weryfikacja: użytkownik
