# Proposal

## Why

Zdjęcie udostępnione do Czyżyk Connect trafia dziś tylko do wiadomości ze zdjęciem z czatu z ostatnich godzin. Rodzic, który sam sfotografuje ogłoszenie (np. plakat na drzwiach przedszkola), nie ma wiadomości w czacie, do której można je dołączyć. Aplikacja odpowiada wtedy „nie wiem, do której wiadomości je dołączyć”.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** własne zdjęcie udostępnione do Czyżyk Connect można dodać do dowolnej śledzonej grupy, a dokument trafia do analizy tej grupy.

## What Changes

- Android: po udostępnieniu zdjęcia zawsze pojawia się wybór. Zdjęcie z czatu dołącza się do wiadomości ze zdjęciem z ostatnich godzin, jak dotąd. Własne zdjęcie, bez wiadomości w czacie, idzie do dowolnej śledzonej grupy z listy. Zdjęcie nadal jest sprawdzane na telefonie: zdjęcia ludzi nie wychodzą z telefonu.
- Kolejka dokumentów na telefonie (`PhotoLog`, wersja 3) pamięta grupę własnego zdjęcia.
- API `POST /ingest/document` przyjmuje `group_name` i `shared_at`. Pierwszy dokument z danego udostępnienia tworzy w śledzonej grupie wiadomość: autor „Zdjęcie z telefonu”, źródło `manual`. Kolejne zdjęcia z tego samego udostępnienia dołączają do niej. Grupa nieśledzona jest odrzucana.

**Poza zakresem:** zdjęcia dotyczące całego przedszkola bez wyboru grupy; o tym, że sprawa dotyczy całego przedszkola, rozstrzyga analiza treści.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `document-import`: własne zdjęcie bez wiadomości w czacie można dodać do wybranej śledzonej grupy.

## Impact

- Android: `MainActivity` (wybór), `PhotoLog` (wersja 3), `PhotoWorker.keep`, `IngestApi.sendDocument`, test `PhotoLogTest`.
- Shared: `documentIngestSchema`.
- API: `ingest/routes.ts` i jego test.
