# Tasks

## 1. Baza

- [x] 1.1 Migracja `0018_llm_calls.sql` (RLS: odczyt admin, brak zapisu dla ról API); weryfikacja: testy dostępu (admin czyta, rodzina pusty wynik, anon odmowa)

## 2. Worker

- [x] 2.1 Wpis przy każdym wywołaniu ekstrakcji (sukces i błąd), retencja 14 dni, błąd zapisu nie przerywa analizy; weryfikacja: testy na lokalnej bazie

## 3. PWA

- [x] 3.1 Admin → LLM: lista i podgląd wpisu; weryfikacja: testy komponentu
