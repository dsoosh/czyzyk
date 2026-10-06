# Tasks

## 1. Wspólny schemat i konfiguracja

- [x] 1.1 `packages/shared/src/assistant.ts`: `assistantAskSchema` (widok, pytanie, historia); weryfikacja: testy jednostkowe (poprawny widok, nieznany rodzaj, za długie pytanie, historia nienaprzemienna)
- [x] 1.2 Konfiguracja API: `ANTHROPIC_API_KEY`, `CHAT_MODEL` (opcjonalne), `ASSISTANT_DAILY_LIMIT`; `.env.example`, `.railway/railway.ts`; weryfikacja: test konfiguracji, `npm run typecheck`

## 2. API

- [x] 2.1 Budowanie kontekstu widoku z bazy (tylko `active`, tylko grupy śledzone); weryfikacja: testy bazy dla każdego rodzaju widoku, w tym pominięcie `needs_review`
- [x] 2.2 `POST /assistant/ask`: sesja, profil rodziny, limity, prompt, wywołanie modelu przez interfejs (atrapa w testach), logi bez treści; weryfikacja: testy API (401, 403, 429, 503 bez konfiguracji, odpowiedź, prompt zawiera dane widoku i oznaczenie niezaufanych danych, log bez treści)

## 3. PWA

- [x] 3.1 `AssistantPanel`: przycisk „Zapytaj”, rozmowa, opis widoku z bieżącej trasy, obsługa 429/503; weryfikacja: testy komponentu (widok kalendarza wysyła miesiąc, historia grupy wysyła id grupy, kolejne pytanie zawiera historię, komunikat limitu)
