# Tasks

## 1. Baza

- [x] 1.1 Migracja `0009_realtime_extraction.sql`: funkcja `notify_message_ingested` i trigger na `messages` (tylko nieprzetworzone, aktywne; ładunek = `group_id`); weryfikacja: test bazy – `LISTEN` dostaje jedno powiadomienie z identyfikatorem grupy po wstawieniu kilku wiadomości w jednej transakcji, żadnego dla wiadomości przetworzonej

## 2. Worker

- [x] 2.1 `EXTRACTION_DELAY_SECONDS` zamiast `EXTRACTION_DEBOUNCE_MINUTES` (config, `.env.example`, README, `.railway/railway.ts`); weryfikacja: testy konfiguracji i `npm run typecheck`
- [x] 2.2 Nasłuch `message_ingested` z odnawianiem połączenia, kolejkowanie `extract-group` ze `startAfter`; weryfikacja: test bazy – wiadomość wstawiona po starcie workera zostaje przetworzona bez wywołania skanu, seria trafia do jednej ekstrakcji
- [x] 2.3 Test przepływu end-to-end bez ręcznego skanu (`tests/e2e`); weryfikacja: `npm run test:db`
