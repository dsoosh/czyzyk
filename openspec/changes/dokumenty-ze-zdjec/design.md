# Design

## Context

Istnieje: udostępnianie eksportu do Czyżyk Connect (`SharedChat.kt`), przekazanie tekstu do PWA przez most `CzyzykAndroid.takeSharedChat()`, ekran Admin → Import, `POST /import/chat` (sesja admina) i ekstrakcja tekstowa w workerze. Plan etapu 4 (`etap-4-eksport-i-zdjecia/design.md`) zakładał osobną paczkę przefiltrowaną w Storage i upload z telefonu tokenem urządzenia; ta zmiana używa istniejącej ścieżki importu, bo dokumentów w eksporcie jest niewiele.

## Goals / Non-Goals

**Goals:**
- Żaden obraz z wykrytą osobą nie opuszcza telefonu; błąd lub wątpliwość = `withheld`.
- Dokumenty wzbogacają istniejącą ekstrakcję tekstową, bez osobnego potoku elementów.
- Ponowny import tej samej paczki nie dubluje dokumentów.

**Non-Goals:**
- Przechowywanie zdjęć z zajęć gdziekolwiek poza telefonem (także jako opis).
- Podgląd dokumentów w PWA (osobna zmiana).

## Decisions

### D1. Reguła na telefonie (jak etap 4, D2)
ML Kit z modelami w APK: wykrywanie twarzy (tryb dokładny, minimalny rozmiar twarzy 5%), etykietowanie obrazu (etykiety związane z ludźmi, próg 0,3), rozpoznawanie tekstu (alfabet łaciński). Reguła w czystym Kotlinie (`ScreeningRule`), testowana jednostkowo:
1. błąd, obraz < 400 px, plik nieobrazowy → `withheld`;
2. tekst < 15 słów i pokrycie tekstem < 5% → `withheld`;
3. twarz lub etykieta osoby → `text_only`;
4. w pozostałych przypadkach → `image`.
Analizowane są tylko obrazy wymienione w `_chat.txt` (JPEG, PNG, WebP), najwyżej 300 na eksport; reszta `withheld`. Obraz `image` jest skalowany do 2048 px i kodowany na nowo do JPEG 85% – nowy plik nie ma EXIF.

### D2. Przekazanie przez PWA
Dokumenty jadą razem z tekstem czatu przez most (`takeSharedChat` → `{fileName, text, documents[], withheld}`; obraz w base64) i w tym samym żądaniu `POST /import/chat` (`documents[]`, maks. 40 dokumentów, 1,5 MB na obraz). Import jest atomowy: wiadomości i dokumenty w jednej transakcji, dokument łączony z wiadomością po nazwie pliku z parsera.
- *Alternatywa:* upload z telefonu tokenem urządzenia do Storage (plan etapu 4) – osobny kanał, kolejność importu i uploadu do pilnowania; zostaje na eksport na klik.

### D3. Obraz w bazie zamiast Storage
Obraz dokumentu w tabeli `attachment_files (attachment_id, bytes)` z RLS bez polityk – czyta go tylko serwer. Dokumentów jest kilka miesięcznie, a testy bazy działają na czystym Postgresie bez schematu `storage`.
- *Alternatywa:* prywatny bucket `media` – zostaje opcją przy podglądzie w PWA, gdy będzie potrzebny signed URL.

### D4. Kontrola zapasowa przed ekstrakcją
Zadanie ekstrakcji grupy najpierw przetwarza dokumenty grupy w stanie `pending`: model z wizją (`DOCUMENT_MODEL` ?? `EXTRACTION_MODEL`) przez narzędzie zwraca `{contains_people, description, text}`. `contains_people` → usunięcie obrazu, decyzja `text_only`, zostaje tekst z telefonu. Odmowa modelu → obraz usunięty (bezpieczniej), tekst z telefonu. Inne błędy → zadanie się powtarza. Dokument kończy w stanie `ready` z najlepszym tekstem (przepisanym przez model albo z telefonu).

### D5. Dokument w prompcie
Wiadomość z gotowymi dokumentami dostaje w prompcie dopisek `[dokument: "…"]` (tekst ucięty do 4000 znaków, w cudzysłowie jak treść wiadomości – niezaufane dane). Nowy dokument przy wiadomości już przetworzonej z okresu ekstrakcji zeruje `processed_at`, więc wiadomość wraca do ekstrakcji.

## Risks / Trade-offs

- [Detektor przepuści osobę] → dwa kryteria (twarz, etykieta), kontrola zapasowa na serwerze, domyślnie `withheld`.
- [Etykiety ML Kit bez „osoby”] → lista kilkunastu etykiet związanych z ludźmi (dziecko, uśmiech, dłoń, selfie, tłum…), plus twarze.
- [Duży JSON przez most] → limit 40 dokumentów, skalowanie, reszta `withheld` z komunikatem.
- [Czas analizy na telefonie] → analiza w tle z licznikiem postępu; limit 300 obrazów.

## Migration Plan

`0018_documents.sql`. Aktualizacja APK z GitHuba. Bez nowych sekretów; `DOCUMENT_MODEL` opcjonalny.

## Open Questions

- Progi do dostrojenia na prawdziwych eksportach (bez zmiany reguły).
