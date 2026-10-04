# Proposal

## Why

Powiadomienia nie niosą zdjęć ani dokumentów, a gubią wiadomości przy otwartym czacie lub wyciszonej grupie. Plany miesiąca, jadłospisy i zdjęcia z zajęć – najcenniejsza część komunikacji przedszkola – są dziś poza aplikacją. Eksport czatu z WhatsAppa (oficjalna funkcja aplikacji) uzupełnia luki i dostarcza multimedia.

Etap 4 z `docs/specyfikacja.md` („Eksport i zdjęcia”). **Gotowe, gdy:** zdjęcie planu miesiąca daje wydarzenia, a zdjęcia z zajęć trafiają do albumu z podpisem.

## What Changes

- Android: eksport na klik (lokalne powiadomienie „Zsynchronizuj czaty”, przycisk, kafelek Szybkich ustawień), automatyzacja menu WhatsAppa przez usługę ułatwień dostępu, cel udostępniania dla ZIP-ów (także ręcznych), wysyłka przez podpisany URL, raportowanie błędów z nazwą kroku i wersją WhatsAppa.
- `services/api`: `POST /ingest/export/upload-url`, `POST /ingest/export`.
- `services/worker`: rozpakowanie ZIP, parser `_chat.txt` (formaty PL/EN, wieloliniowe, systemowe, załączniki), scalanie z wiadomościami z powiadomień, zapis załączników w bucketcie `media`, usunięcie ZIP-a, ekstrakcja zaraz po imporcie.
- Triaż zdjęć modelem z wizją: dokument / zdjęcie z zajęć / inne; ekstrakcja z dokumentów; albumy; miniatury WebP; deduplikacja pHash.
- PWA: galeria albumów i podgląd dokumentów źródłowych przez podpisane URL-e.

**Poza zakresem:** album roku, zaznaczanie do fotoksiążki, pobieranie ZIP (etap 6); obsługa wiadomości usuniętych (etap 6); embeddingi podpisów (etap 5).

## Capabilities

### New Capabilities

- `chat-export`: pozyskanie eksportu czatu z telefonu (automatycznie na klik lub ręcznie) i bezpieczne przekazanie go na serwer.
- `export-import`: przetworzenie paczki eksportu na wiadomości i załączniki, scalanie z danymi z powiadomień.
- `media-triage`: klasyfikacja i opis zdjęć oraz dokumentów, ekstrakcja elementów z dokumentów, grupowanie zdjęć w albumy.
- `photo-gallery`: przeglądanie albumów zdjęć z zajęć w PWA.

### Modified Capabilities

(brak zmian wymagań istniejących capability; elementy z dokumentów korzystają z `item-extraction` i `source-trace` bez zmian ich wymagań)

## Impact

- Android: `AccessibilityService`, `TileService`, aktywność z filtrem `ACTION_SEND` dla `application/zip`; nowe uprawnienia wymagające ręcznego włączenia.
- Storage Supabase: prywatne buckety `exports` i `media`.
- Zależności: `yauzl` (ZIP), `sharp`, `sharp-phash` lub własny pHash; model z wizją (`TRIAGE_MODEL`).
- Baza: migracja z kolumnami albumów i indeksem pHash, RPC podpisywania URL-i przez API.
