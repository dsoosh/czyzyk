# Design

## Decisions

### D1. Dziennik w bazie, nie w logach
Treść wiadomości jest w bazie i tak (tabela `messages`, czytelna dla rodziny), więc wpis w `llm_calls` z RLS „tylko admin” nie poszerza kręgu osób z dostępem. Logi serwera (Railway) zostają bez treści.

### D2. Zakres i retencja
Zapisywane: rodzaj (`extraction`), grupa, nazwa modelu z konfiguracji, prompt systemowy i treść użytkownika, operacje zwrócone przez model albo kod błędu, tokeny, czas w ms. Worker przy każdym wpisie usuwa wpisy starsze niż 14 dni. Zapis dziennika nie może przerwać ekstrakcji (błąd zapisu jest tylko logowany bez treści).

### D3. Asystent poza dziennikiem
Wątki asystenta są prywatne dla właściciela (RLS); dziennik admina by to łamał.
