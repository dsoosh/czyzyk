# Design

## Context

Stan po etapie 3: pełny przepływ tekstowy z powiadomień, interakcje i push. Brak multimediów. Motywacja: `proposal.md`. Wymagania: `specs/*`. To najbardziej kruchy element systemu (zależny od UI WhatsAppa), dlatego ręczny eksport przez udostępnianie jest pełnoprawną ścieżką awaryjną.

## Goals / Non-Goals

**Goals:**
- Import idempotentny: ta sama paczka importowana dwa razy daje ten sam stan bazy.
- Parser sterowany fixtures (PL/EN) z prawdziwych eksportów.

**Non-Goals:**
- Filmy i notatki głosowe – zapisywane jako załączniki bez triażu.

## Decisions

### D1. Automatyzacja eksportu
`AccessibilityService` z maszyną stanów (kroki: `otworz_czat`, `menu`, `wiecej`, `eksportuj_czat`, `dolacz_multimedia`, `wybierz_czyzyk`), każdy z timeoutem 10 s. Czat otwierany intencją `https://wa.me/...` nie działa dla grup, więc: wyszukiwarka czatów WhatsApp z nazwą grupy. Selektory: `resource-id` (`com.whatsapp:id/...`), zapasowo tekst PL/EN. Wersja WhatsAppa z `PackageManager`.
- *Alternatywa:* UIAutomator/ADB z komputera – wymaga komputera, sprzeczne z „na klik w telefonie”.

### D2. Upload
API wydaje `createSignedUploadUrl` (Supabase Storage, bucket `exports`, ścieżka `<device>/<uuid>.zip`); telefon wysyła PUT, potem `POST /ingest/export {path, group_name, wa_version, exported_at}`. Rejestracja idempotentna po `path`.
- *Alternatywa:* upload przez API – podwójny transfer dużych plików przez Railway.

### D3. Parser
Wykrywanie formatu na pierwszych 50 liniach spośród zestawu wzorców (`dd.MM.yyyy, HH:mm - `, `dd.MM.yyyy, HH:mm:ss`, `[dd.MM.yy, HH:mm:ss]`, `M/d/yy, h:mm a - `, …); linia bez nagłówka dokleja się do poprzedniej wiadomości. Znaczniki załączników: `(plik załączony)`, `(file attached)`, `<załączony: …>`, `<attached: …>`; „‎<Pominięto multimedia>” = brak pliku. Strumieniowe czytanie ZIP (`yauzl`) bez rozpakowywania na dysk. Fixtures w `services/worker/test/fixtures/export-{pl,en}/`.
- *Alternatywa:* gotowe biblioteki parsera WhatsApp – słabo utrzymane i bez polskich wariantów.

### D4. Scalanie
Klucz dopasowania z etapu 2; przy braku trafienia dodatkowa próba: ta sama grupa, ta sama minuta, ten sam hash treści, inny autor (różnice nazw kontaktu) – jeśli dokładnie jeden kandydat. Aktualizacja w miejscu (`source = 'export'`), więc `source_message_ids` elementów się nie zmieniają.

### D5. Triaż
Zadanie `triage-image` per obraz; model `TRIAGE_MODEL` (domyślnie Haiku, z wizją) z narzędziem zwracającym `{category, caption, operations[]}` – `operations` tym samym schematem co ekstrakcja tekstu. Albumy: po triażu wszystkich obrazów paczki, grupowanie per autor z przerwą ≤ 10 min; tytuł i podpis z otaczającego tekstu przez to samo wywołanie dla pierwszego zdjęcia serii (przekazujemy tekst sąsiednich wiadomości). pHash 64-bit (DCT na 32×32 w `sharp`), duplikat przy odległości Hamminga ≤ 6.
- *Alternatywa:* osobne wywołanie dla albumu – droższe, a podpis wynika z tego samego kontekstu.

## Risks / Trade-offs

- [Zmiany UI WhatsAppa] → raport kroku i wersji, ręczny eksport działa zawsze.
- [Duże paczki (setki MB)] → strumieniowe przetwarzanie, limit rozmiaru i eksport tylko śledzonych grup.
- [Koszt wizji] → triaż tylko nowych obrazów (pHash przed wywołaniem modelu).

## Migration Plan

Migracja `0006_media.sql` (buckety, polityki Storage tylko dla serwera, kolumny i indeksy); APK z nowymi uprawnieniami wymaga ręcznego włączenia usługi ułatwień dostępu (instrukcja w aplikacji).

## Open Questions

- Czy obrazy `other` kasować z magazynu, czy zachować w ukrytym folderze – nie zmienia zachowania widocznego dla rodziny (galeria ich nie pokazuje); domyślnie zachowujemy do decyzji właściciela.
- Próbka prawdziwego `_chat.txt` z telefonu właściciela potrzebna do fixtures – wymagana przed zadaniem 3.1.
