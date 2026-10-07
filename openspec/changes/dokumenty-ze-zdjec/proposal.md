# Proposal

## Why

Plany miesiąca, jadłospisy i ogłoszenia przedszkole często wysyła jako zdjęcia. Powiadomienia nie niosą obrazów, a import eksportu (zmiana `import-eksportu-z-pwa`) świadomie wysyła tylko tekst czatu, więc te informacje są dziś poza aplikacją. Użytkownik poprosił o sprawdzanie zdjęć na telefonie i wysyłanie tylko tych, które dotyczą spraw organizacyjnych.

Zmiana poza kolejnością etapów, na prośbę użytkownika (jak `import-eksportu-z-pwa`). Realizuje rdzeń etapu 4 (`etap-4-eksport-i-zdjecia`): kontrolę obrazów na telefonie (D2), przekazanie dokumentów i kontrolę zapasową na serwerze (D6) – na istniejącej ścieżce „Udostępnij → Czyżyk Connect → Admin → Import”. Decyzja z 2026-10-04 obowiązuje bez zmian: zdjęcia z ludźmi nie opuszczają telefonu.

**Gotowe, gdy:** po udostępnieniu do Czyżyk Connect eksportu z multimediami zdjęcie planu lub ogłoszenia daje wydarzenia i rzeczy do przyniesienia, a zdjęcia z zajęć nie trafiają na serwer – ani jako plik, ani jako tekst.

## What Changes

- Android (Czyżyk Connect): przy udostępnieniu ZIP-a z multimediami każdy obraz wymieniony w czacie jest sprawdzany lokalnie (ML Kit z modelami w APK: twarze, etykiety osób, rozpoznawanie tekstu) i dostaje decyzję `image`, `text_only` albo `withheld`. Obraz `image` jest przeskalowany i zapisany na nowo jako JPEG (bez metadanych EXIF, w tym GPS). Przekazywane do PWA są tylko dokumenty `image` (obraz + tekst) i `text_only` (sam tekst) oraz liczba wstrzymanych.
- `packages/shared`: parser eksportu zwraca nazwy plików załączników wiadomości.
- `services/api`: `POST /import/chat` przyjmuje dokumenty (opcjonalnie), łączy je z wiadomościami po nazwie pliku, zapisuje obraz w bazie (tabela dostępna tylko dla serwera), deduplikuje po `sha256`.
- `services/worker`: przed ekstrakcją grupy kontrola zapasowa każdego nowego obrazu modelem z wizją (`DOCUMENT_MODEL`, domyślnie `EXTRACTION_MODEL`): wykrycie ludzi usuwa obraz i zostawia tekst; model przepisuje treść dokumentu. Tekst dokumentu trafia do promptu ekstrakcji przy wiadomości.
- PWA: ekran importu pokazuje, ile zdjęć poszło jako dokument, ile jako sam tekst, a ile zostało na telefonie.

**Poza zakresem (zostaje w etapie 4):** eksport na klik (usługa ułatwień dostępu, kafelek, przypomnienia), PDF-y (zawsze `withheld`), podgląd obrazu dokumentu w PWA, zestaw regresji ok. 40 obrazów z testami instrumentalnymi, import zdjęć z ZIP-a wybranego w przeglądarce (bez kontroli na telefonie obrazy dalej nie opuszczają urządzenia).

## Capabilities

### New Capabilities

- `shared-document-screening`: kontrola obrazów z udostępnionego eksportu na telefonie i przekazanie wyłącznie dokumentów organizacyjnych.
- `document-import`: przyjęcie dokumentów przy imporcie eksportu, kontrola zapasowa na serwerze i użycie treści dokumentów w ekstrakcji.

### Modified Capabilities

(brak; `chat-export-upload` ze zmiany `import-eksportu-z-pwa` nie jest jeszcze zarchiwizowane – rozszerzenie opisuje `document-import`)

## Impact

- Android: zależności ML Kit (face-detection, image-labeling, text-recognition) w wariantach z modelami w APK – większy APK (kilkanaście MB), brak pobierania modeli przez Google Play Services.
- Baza: migracja `0018_documents.sql` – kolumny `attachments` (`file_name`, `screening`, `doc_text`, `description`, `sha256`, `doc_status`), tabela `attachment_files` z RLS bez polityk (tylko serwer).
- API: limit treści `/import/chat` podniesiony o dokumenty (do 40 MB łącznie).
- Worker: zmienna `DOCUMENT_MODEL` (opcjonalna).
