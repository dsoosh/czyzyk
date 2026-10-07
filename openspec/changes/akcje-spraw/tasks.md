# Tasks

## 1. Dane i analiza

- [x] 1.1 Schemat `suggestions` w `@czyzyk/shared`, reguła 15 w domyślnym prompcie; weryfikacja: testy schematu (przyjęcie, brak przy aktualizacji, nieznany rodzaj)
- [x] 1.2 Migracja `0016_action_suggestions.sql`; weryfikacja: testy bazy (przeniesienie do rzeczy/płatności/kalendarza, odpowiedź, cofnięcie, błędy, uprawnienia, limit)
- [x] 1.3 Worker: zapis propozycji, aktualizacja ich nie kasuje; weryfikacja: test bazy

- [x] 1.4 Uzupełnianie propozycji istniejących spraw (kontekst z `suggestions`, reguła, zapis bez zmiany statusu i przeglądu); weryfikacja: test bazy (sprawa zatwierdzona przez admina, niska pewność operacji)

## 2. PWA

- [x] 2.1 Przyciski akcji na liście spraw i ekranie „Dziś”, potwierdzenie i adnotacja; weryfikacja: testy komponentów
