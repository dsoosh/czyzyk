# Tasks

## 1. PWA

- [x] 1.1 `lib/history.ts`: lista śledzonych grup z ostatnią wiadomością, historia z limitem, wyszukiwanie z escapowaniem; weryfikacja: testy jednostkowe escapowania
- [x] 1.2 Ekrany „Czaty” i historia grupy, zakładka w menu; weryfikacja: testy komponentów (tylko śledzone grupy, 50 → 100 wiadomości, wyszukiwanie, separator dnia)

## 2. Dostęp

- [x] 2.1 Weryfikacja RLS dla historii; weryfikacja: istniejący test bazy „zalogowany bez profilu dostaje pusty wynik” obejmuje `messages` i `wa_groups` (`npm run test:db`)
