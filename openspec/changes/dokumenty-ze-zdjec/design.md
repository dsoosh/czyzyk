# Design

## Context

Czyżyk Connect czyta powiadomienia WhatsAppa; wiadomość ze zdjęciem ma treść „📷 Zdjęcie” (`has_attachment`). WhatsApp z włączonym automatycznym pobieraniem zapisuje zdjęcie w `Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images/` (widoczne w MediaStore) zaraz po otrzymaniu. Plan etapu 4 zakładał eksport czatu z multimediami; ta zmiana bierze zdjęcia z folderu automatycznie.

## Goals / Non-Goals

**Goals:**
- Żaden obraz z wykrytą osobą nie opuszcza telefonu; błąd lub wątpliwość = nic nie jest wysyłane.
- Zdjęcie z prywatnego czatu albo innej grupy nigdy nie zostaje przypisane do wiadomości obserwowanej grupy.
- Model analizujący wiadomości widzi zdjęcie dokumentu.

**Non-Goals:**
- Przechowywanie zdjęć z zajęć gdziekolwiek poza telefonem (także jako opis).

## Decisions

### D1. Dopasowanie po czasie, tylko jednoznaczne
Dla każdego powiadomienia WhatsAppa (każdy czat) telefon zapisuje lokalnie zdjęcia: klucz, czas pierwszego zobaczenia i – tylko dla obserwowanej grupy – klucz wiadomości i nazwę grupy; żadnej treści. Plik z „WhatsApp Images” (bez folderu „Sent”) o czasie dodania `t` jest łączony, gdy wszystkie powiadomienia o zdjęciach z okna `[t − 10 min, t + 2 min]` pochodzą z tej samej obserwowanej grupy – wtedy z najbliższym wcześniejszym (album). Zdjęcie z innego czatu w oknie → plik pomijany. Brak powiadomienia przez godzinę → plik pomijany. Kontrola uruchamia się 90 s po powiadomieniu o zdjęciu z obserwowanej grupy (czas na pobranie) oraz przy okresowej synchronizacji.
- *Alternatywa:* eksport czatu z multimediami (plan etapu 4) – ręczny i rzadki; zostaje jako przyszła ścieżka.

### D2. Reguła na telefonie (jak etap 4, D2)
ML Kit z modelami w APK: wykrywanie twarzy (tryb dokładny, min. 5%), etykietowanie obrazu (etykiety związane z ludźmi, próg 0,3), rozpoznawanie tekstu. Reguła w czystym Kotlinie (`ScreeningRule`): błąd, obraz < 400 px → `withheld`; < 15 słów i pokrycie tekstem < 5% → `withheld`; twarz lub etykieta osoby → `text_only` (pusty tekst → `withheld`); w pozostałych przypadkach `image`. Obraz `image` jest skalowany do 2048 px i kodowany na nowo do JPEG (≤ 1,5 MB) – bez EXIF.

### D3. Wysyłka tokenem urządzenia
`POST /ingest/document {idempotency_key, file_name, screening, text, image?}` po dostarczeniu wiadomości; 404 (wiadomości jeszcze nie ma) → ponowienie, rezygnacja po 30 próbach lub 2 dniach. Pliki czekające na wysyłkę leżą w prywatnym katalogu aplikacji i są kasowane po wysyłce.

### D4. Obraz w bazie zamiast Storage
Obraz w tabeli `attachment_files (attachment_id, bytes)` z RLS bez polityk – czyta go tylko serwer. Dokumentów jest kilka miesięcznie, a testy bazy działają na czystym Postgresie.

### D5. Kontrola zapasowa przed analizą
Zadanie analizy grupy najpierw sprawdza jej dokumenty `pending` modelem z wizją (`DOCUMENT_MODEL` ?? `EXTRACTION_MODEL`): narzędzie zwraca `{contains_people, description}`. Ludzie albo odmowa → obraz usunięty, zostaje tekst z telefonu. Inny błąd → zadanie się powtarza (dokument czeka). Wywołanie trafia do dziennika LLM (rodzaj `document`, bez obrazu).

### D6. Dokument w analizie
Wiadomość dostaje w prompcie dopisek `[dokument "nazwa" (obraz poniżej): "tekst"]` (tekst do 4000 znaków, w cudzysłowie – niezaufane dane). Obrazy dokumentów nowych wiadomości (maks. 5) idą po treści zapytania, każdy po etykiecie z aliasem wiadomości. Stała część promptu wyjaśnia dopisek i każe rozstrzygać według obrazu. Nowy dokument przy przetworzonej wiadomości wraca ją do analizy.

## Risks / Trade-offs

- [Detektor przepuści osobę] → dwa kryteria na telefonie, kontrola zapasowa na serwerze.
- [Zdjęcie trafi do złej wiadomości] → tylko jednoznaczne okno czasu, zdjęcia z innych czatów blokują dopasowanie.
- [WhatsApp nie pobiera zdjęć automatycznie] → brak pliku = brak dokumentu; instrukcja w aplikacji.
- [Koszt modelu] → obraz tylko dla dokumentów (kilka w miesiącu).

## Migration Plan

`0019_documents.sql`; aktualizacja APK; użytkownik włącza „Zdjęcia z grup” i zgadza się na dostęp do zdjęć.

## Open Questions

- Progi detektorów do dostrojenia na prawdziwych zdjęciach z grup (bez zmiany reguły).
