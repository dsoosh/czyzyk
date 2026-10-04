# Proposal

## Why

Powiadomienia nie niosą obrazów, a gubią wiadomości przy otwartym czacie lub wyciszonej grupie. Plany miesiąca, jadłospisy i plakaty – ważna część komunikacji przedszkola – są dziś poza aplikacją. Eksport czatu z WhatsAppa (oficjalna funkcja aplikacji) uzupełnia luki i dostarcza obrazy dokumentów.

Grupy przedszkolne zawierają jednak przede wszystkim zdjęcia dzieci, także cudzych. Zgodnie z decyzją z 2026-10-04 (`docs/specyfikacja.md`) obrazy są analizowane wyłącznie na telefonie, a na serwer trafiają tylko dokumenty z informacjami organizacyjnymi, bez ludzi. Aplikacja nie gromadzi zdjęć z zajęć.

Etap 4 z `docs/specyfikacja.md` („Eksport i zdjęcia”), ze zmienionym kryterium. **Gotowe, gdy:** zdjęcie planu miesiąca daje wydarzenia, a zdjęcia z zajęć (z dziećmi) nie opuszczają telefonu – ani jako plik, ani jako tekst.

## What Changes

- Android: eksport na klik (lokalne powiadomienie „Zsynchronizuj czaty”, przycisk, kafelek Szybkich ustawień), automatyzacja menu WhatsAppa przez usługę ułatwień dostępu, cel udostępniania dla ZIP-ów (także ręcznych), raportowanie błędów z nazwą kroku i wersją WhatsAppa.
- Android: kontrola obrazów na telefonie (wykrywanie twarzy i osób, rozpoznawanie tekstu, modele lokalne) przed wysyłką; z paczki eksportu powstaje paczka przefiltrowana: `_chat.txt`, obrazy dokumentów bez ludzi, sam tekst z dokumentów z ludźmi, manifest decyzji. Oryginalny eksport jest kasowany z telefonu po przetworzeniu.
- `services/api`: `POST /ingest/export/upload-url`, `POST /ingest/export`.
- `services/worker`: parser `_chat.txt` (formaty PL/EN, wieloliniowe, systemowe, załączniki), scalanie z wiadomościami z powiadomień, zapis dokumentów w bucketcie `media`, usunięcie paczki, ekstrakcja zaraz po imporcie.
- Ekstrakcja z dokumentów: model z wizją dla obrazów, ekstrakcja tekstowa dla tekstu rozpoznanego na telefonie; serwerowa kontrola zapasowa usuwająca obraz, na którym model rozpozna ludzi.
- PWA: podgląd dokumentu źródłowego w widoku „skąd to wiem”.

**Poza zakresem:** galeria, albumy, album roku, fotoksiążka i jakiekolwiek przechowywanie zdjęć z zajęć (rezygnacja na stałe); filmy i notatki głosowe (nigdy nie są wysyłane); obsługa wiadomości usuniętych (etap 6); embeddingi opisów dokumentów (etap 5).

## Capabilities

### New Capabilities

- `chat-export`: pozyskanie eksportu czatu z telefonu (automatycznie na klik lub ręcznie) i przekazanie na serwer wyłącznie jego przefiltrowanej części.
- `on-device-image-screening`: decyzja na telefonie, co z każdego załącznika eksportu może opuścić telefon (obraz, sam tekst, nic).
- `export-import`: przetworzenie przefiltrowanej paczki na wiadomości i załączniki-dokumenty, scalanie z danymi z powiadomień.
- `document-extraction`: ekstrakcja elementów z obrazów dokumentów i tekstu rozpoznanego na telefonie, z serwerową kontrolą zapasową.

### Modified Capabilities

(brak zmian wymagań istniejących capability; elementy z dokumentów korzystają z `item-extraction` i `source-trace` bez zmian ich wymagań)

## Impact

- Android: `AccessibilityService`, `TileService`, aktywność z filtrem `ACTION_SEND` dla `application/zip`, lokalne modele ML (wykrywanie twarzy, etykietowanie obrazu, rozpoznawanie tekstu) dołączone do APK; nowe uprawnienia wymagające ręcznego włączenia.
- Storage Supabase: prywatne buckety `exports` (paczki przefiltrowane, kasowane po imporcie) i `media` (wyłącznie obrazy dokumentów).
- Zależności serwera: `yauzl` (ZIP), `sharp` (miniatury dokumentów); model z wizją (`DOCUMENT_MODEL`).
- Baza: kolumny `attachments` (`screening`, `ocr_text`, `sha256`), bez tabeli albumów (etap 1 jej nie tworzy).
