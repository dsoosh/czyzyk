# Design

## Context

Stan po etapie 3: pełny przepływ tekstowy z powiadomień, interakcje i push; brak multimediów. Motywacja: `proposal.md` (w tym decyzja z 2026-10-04: zdjęcia tylko na telefonie). Wymagania: `specs/*`. Eksport na klik jest najbardziej kruchym elementem (zależnym od UI WhatsAppa), dlatego ręczny eksport przez udostępnianie jest pełnoprawną ścieżką awaryjną. Kontrola obrazów jest najważniejszym zabezpieczeniem prywatności w całym systemie.

## Goals / Non-Goals

**Goals:**
- Żaden obraz z ludźmi nie opuszcza telefonu; błędy kontroli prowadzą do wstrzymania, nigdy do wysyłki.
- Import idempotentny: ta sama paczka importowana dwa razy daje ten sam stan bazy.
- Parser sterowany fixtures (PL/EN) z prawdziwych eksportów.

**Non-Goals:**
- Przechowywanie zdjęć z zajęć gdziekolwiek poza telefonem (także jako miniatury lub opisy).
- Analiza filmów i notatek głosowych.

## Decisions

### D1. Automatyzacja eksportu
`AccessibilityService` z maszyną stanów (kroki: `otworz_czat`, `menu`, `wiecej`, `eksportuj_czat`, `dolacz_multimedia`, `wybierz_czyzyk`), każdy z timeoutem 10 s. Czat otwierany przez wyszukiwarkę czatów WhatsApp z nazwą grupy (link `wa.me` nie działa dla grup). Selektory: `resource-id` (`com.whatsapp:id/...`), zapasowo tekst PL/EN. Wersja WhatsAppa z `PackageManager`.
- *Alternatywa:* eksport bez multimediów – prostszy i bez zdjęć w ogóle, ale tracimy plany i plakaty; „Dołącz multimedia” + filtr na telefonie daje oba.

### D2. Kontrola obrazów na telefonie
ML Kit w wariancie z modelami dołączonymi do APK (bez pobierania przez Google Play Services i bez wywołań sieciowych): Face Detection (tryb dokładny, minimalny rozmiar twarzy 5% krótszego boku), Image Labeling (etykiety osób, próg 0,3), Text Recognition v2 (alfabet łaciński). Reguła:
1. Brak tekstu (< 15 słów lub < 5% powierzchni pokrytej tekstem) → `withheld`.
2. Tekst i (twarz lub etykieta osoby) → `text_only` (tekst z OCR).
3. Tekst, brak twarzy i osób → `image`.
4. Wyjątek, timeout 5 s, obraz < 400 px → `withheld`.
Obraz jest przed analizą skalowany do maks. 2048 px. Progi w jednym pliku konfiguracji z testami regresji na zestawie ok. 40 obrazów (dokumenty, plakaty z dziećmi, zdjęcia z zajęć, zrzuty ekranu, memy). PDF renderowany `PdfRenderer` strona po stronie.
- *Alternatywa:* model językowy na urządzeniu (Gemini Nano przez AICore) – dostępny tylko na części telefonów i niedeterministyczny; *alternatywa 2:* sama detekcja twarzy – przepuszcza osoby z profilu lub z tyłu, stąd dodatkowe etykietowanie.

### D3. Paczka przefiltrowana
Aplikacja kopiuje udostępniony ZIP do katalogu prywatnego, czyta go strumieniowo, buduje nowy ZIP: `_chat.txt`, pliki `image`, `manifest.json` (`{version, group_name, files: [{name, decision, sha256?, ocr_text?}]}`), po czym kasuje oryginał i pliki tymczasowe. Rejestr `sha256` przetworzonych plików w Room pozwala nie analizować ponownie tych samych obrazów przy kolejnych eksportach (decyzja zapamiętana).
- *Alternatywa:* wysyłka pojedynczych plików zamiast ZIP – więcej żądań i trudniejsza atomowość importu.

### D4. Upload
API wydaje `createSignedUploadUrl` (Supabase Storage, bucket `exports`, ścieżka `<device>/<uuid>.zip`); telefon wysyła PUT, potem `POST /ingest/export {path, group_name, wa_version, exported_at}`. Rejestracja idempotentna po `path`.
- *Alternatywa:* upload przez API – podwójny transfer przez Railway.

### D5. Parser i scalanie
Wykrywanie formatu na pierwszych 50 liniach spośród zestawu wzorców (`dd.MM.yyyy, HH:mm - `, `[dd.MM.yy, HH:mm:ss]`, `M/d/yy, h:mm a - `, …); linia bez nagłówka dokleja się do poprzedniej wiadomości. Znaczniki załączników: `(plik załączony)`, `(file attached)`, `<załączony: …>`, `<attached: …>`, „<Pominięto multimedia>”. Strumieniowe czytanie ZIP (`yauzl`). Scalanie: klucz dopasowania z etapu 2; przy braku trafienia – ta sama grupa, minuta i hash treści przy innym autorze, jeśli dokładnie jeden kandydat. Aktualizacja w miejscu (`source = 'export'`), więc `source_message_ids` elementów się nie zmieniają. Fixtures w `services/worker/test/fixtures/export-{pl,en}/`.
- *Alternatywa:* gotowe biblioteki parsera WhatsApp – słabo utrzymane i bez polskich wariantów.

### D6. Ekstrakcja z dokumentów
Zadanie `extract-document` per załącznik: dla `image` model `DOCUMENT_MODEL` (domyślnie Haiku z wizją) z narzędziem zwracającym `{contains_people, description, operations[]}`; dla `text_only` zwykła ścieżka tekstowa z etapu 2 z tekstem OCR jako treścią. `contains_people = true` → usunięcie obrazu i miniatury, zachowanie tekstu (kontrola zapasowa). Miniatura WebP (`sharp`) tylko dla dokumentów. Deduplikacja po `sha256` z manifestu (pHash z pierwotnej specyfikacji niepotrzebny – dokumenty nie są kompresowane wielokrotnie tak jak zdjęcia).
- *Alternatywa:* brak kontroli zapasowej – prostsze, ale jedyną barierą byłby detektor na telefonie.

## Risks / Trade-offs

- [Detektor na telefonie przepuści osobę] → podwójne kryterium (twarze + etykiety), kontrola zapasowa na serwerze usuwa obraz, zestaw regresji obrazów, podgląd wysłanych obrazów dla właściciela.
- [Detektor zatrzyma dokument z ilustracją dziecka (np. clipart)] → dokument trafia jako tekst (`text_only`), więc informacja nie ginie.
- [Plany w formie tabel słabo czytelne z samego OCR] → dotyczy tylko plakatów z ludźmi; dokumenty bez ludzi idą jako obraz do modelu z wizją.
- [Zmiany UI WhatsAppa] → raport kroku i wersji, ręczny eksport działa zawsze.
- [Duże paczki z multimediami na telefonie] → strumieniowe czytanie ZIP, analiza tylko nowych plików (rejestr `sha256`), przetwarzanie w `WorkManager` z ograniczeniem ładowania przy dużych paczkach.

## Migration Plan

Migracja `0006_media.sql` (buckety, polityki Storage tylko dla serwera, kolumny `attachments.screening`, `ocr_text`, `sha256`, indeks unikalny `sha256`). APK z nowymi uprawnieniami wymaga ręcznego włączenia usługi ułatwień dostępu (instrukcja w aplikacji).

## Open Questions

- Próbka prawdziwego `_chat.txt` z telefonu właściciela potrzebna do fixtures – wymagana przed zadaniem 4.1.
- Progi detektorów (D2) do dostrojenia na zestawie regresji z prawdziwych grup – nie zmienia reguły ani zadań.
