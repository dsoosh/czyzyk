# Proposal

## Why

Plany miesiąca, jadłospisy i ogłoszenia przedszkole często wysyła jako zdjęcia. Powiadomienia nie niosą obrazów (pokazują tylko „📷 Zdjęcie”), więc te informacje są dziś poza aplikacją. Użytkownik zaproponował: zdjęcia z obserwowanych grup sprawdzać na telefonie w folderze „WhatsApp Images”, łączyć z wiadomościami po czasie i – jeśli to sprawy organizacyjne – przesyłać zdjęcie w całości do modelu, żeby analiza była poprawna.

Zmiana poza kolejnością etapów, na prośbę użytkownika (jak `import-eksportu-z-pwa`). Realizuje rdzeń etapu 4 (`etap-4-eksport-i-zdjecia`): kontrolę obrazów na telefonie (D2) i kontrolę zapasową na serwerze (D6), ale bez eksportu czatu – zdjęcia są brane automatycznie z folderu WhatsAppa. Decyzja z 2026-10-04 obowiązuje bez zmian: zdjęcia z ludźmi nie opuszczają telefonu.

**Gotowe, gdy:** zdjęcie jadłospisu lub planu wysłane w obserwowanej grupie daje sprawy w aplikacji (model widzi zdjęcie), a zdjęcia z zajęć nie trafiają na serwer – ani jako plik, ani jako tekst.

## What Changes

- Android (Czyżyk Connect), opcja „Zdjęcia z grup” (wymaga dostępu do zdjęć):
  - telefon zapamiętuje tylko czas powiadomień o zdjęciach (ze wszystkich czatów, bez treści);
  - nowy plik w „WhatsApp Images” jest łączony z wiadomością obserwowanej grupy po czasie, wyłącznie gdy dopasowanie jest jednoznaczne;
  - zdjęcie jest sprawdzane lokalnie (ML Kit z modelami w APK: twarze, etykiety osób, rozpoznawanie tekstu) i dostaje decyzję `image`, `text_only` albo `withheld`;
  - wysyłane są tylko dokumenty: `image` jako nowo zakodowany JPEG bez EXIF z tekstem, `text_only` jako sam tekst.
- `services/api`: `POST /ingest/document` (token urządzenia) – dokument dla dostarczonej wiadomości, deduplikacja po `sha256`, ponowna analiza wiadomości.
- `services/worker`: przed analizą grupy kontrola zapasowa każdego nowego obrazu modelem z wizją (`DOCUMENT_MODEL`, domyślnie `EXTRACTION_MODEL`) – ludzie lub odmowa → obraz usunięty; obraz dokumentu trafia do modelu razem z wiadomością (z etykietą aliasu), tekst dokumentu – do treści wiadomości w prompcie. Kontrola zapasowa trafia do dziennika LLM admina.

**Poza zakresem (zostaje w etapie 4):** eksport czatu na klik, PDF-y, podgląd dokumentu w PWA, zestaw regresji ok. 40 obrazów z testami instrumentalnymi.

## Capabilities

### New Capabilities

- `shared-document-screening`: zdjęcia z obserwowanych grup sprawdzane na telefonie i łączone z wiadomościami; wysyłane wyłącznie dokumenty organizacyjne.
- `document-import`: przyjęcie dokumentów, kontrola zapasowa na serwerze i użycie dokumentów (obraz i tekst) w analizie wiadomości.

### Modified Capabilities

(brak; dziennik LLM ze zmiany `dziennik-llm` dostaje nowy rodzaj wpisu bez zmiany wymagań)

## Impact

- Android: ML Kit (face-detection, image-labeling, text-recognition) z modelami w APK – większy APK; uprawnienie `READ_MEDIA_IMAGES` (Android 13+) / `READ_EXTERNAL_STORAGE` (starsze); WhatsApp musi pobierać zdjęcia automatycznie.
- Baza: migracja `0019_documents.sql` – kolumny `attachments`, tabela `attachment_files` (RLS bez polityk, tylko serwer), nowe rodzaje w `sync_log` i `llm_calls`.
- Worker: opcjonalna zmienna `DOCUMENT_MODEL`; koszt – jedno wywołanie modelu z obrazem na dokument plus obraz w analizie.
