# Tasks

## 1. Telefon

- [x] 1.1 Wybór po udostępnieniu: zdjęcie z czatu albo własne zdjęcie do śledzonej grupy; `PhotoLog` v3 z `group_name`; `IngestApi` wysyła `group_name` i `shared_at`; weryfikacja: `PhotoLogTest`, `./gradlew :app:testDebugUnitTest :app:assembleDebug` w CI

## 2. Serwer

- [x] 2.1 `documentIngestSchema` z `group_name` i `shared_at`; `POST /ingest/document` tworzy wiadomość w śledzonej grupie (jedną na udostępnienie); weryfikacja: `ingest.db.test.ts`
- [ ] 2.2 Na telefonie: zdjęcie plakatu udostępnione do grupy pojawia się w historii grupy i w sprawach; weryfikacja: użytkownik
