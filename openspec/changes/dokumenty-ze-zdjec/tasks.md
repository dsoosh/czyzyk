# Tasks

## 1. Baza i API

- [x] 1.1 Migracja `0019_documents.sql` (kolumny `attachments`, `attachment_files` z RLS bez polityk, rodzaje `document` w `sync_log` i `llm_calls`); weryfikacja: test, że anon, rodzina i admin nie czytają `attachment_files`; test RLS wszystkich tabel
- [x] 1.2 `POST /ingest/document` (token urządzenia, JPEG, `sha256`, 404 przed wiadomością, ponowna analiza, liczby w `sync_log`); weryfikacja: testy na lokalnej bazie

## 2. Worker

- [x] 2.1 Kontrola zapasowa przed analizą (ludzie, odmowa lub brak kontroli → usunięcie obrazu; błąd → ponowienie), wpis w dzienniku LLM; weryfikacja: testy z atrapą modelu na lokalnej bazie
- [x] 2.2 Tekst dokumentu i obraz w zapytaniu analizy, stała reguła w prompcie; weryfikacja: testy promptu, modelu i przebiegu na lokalnej bazie

## 3. Android

- [x] 3.1 Czasy powiadomień o zdjęciach, `PhotoMatcher` (jednoznaczne okno), `ScreeningRule`, `PhotoLog`; weryfikacja: testy jednostkowe
- [x] 3.2 ML Kit z modelami w APK, JPEG bez EXIF, `PhotoWorker` (MediaStore, wysyłka, ponowienia), opcja „Zdjęcia z grup” z uprawnieniem; weryfikacja: build release i testy w CI
- [x] 3.4 Udostępnianie zdjęcia do Czyżyk Connect (`SharedPhotoTarget`, wybór grupy); weryfikacja: testy jednostkowe, build w CI
- [x] 3.5 Podglądy z powiadomień obserwowanych grup z licznikami (eksperyment); weryfikacja: testy jednostkowe `PhotoLog` i parsera, build w CI
- [ ] 3.3 Ręczny test na telefonie: zdjęcie jadłospisu w grupie testowej → dokument i sprawy; zdjęcie z ludźmi → nic nie wysłane; wynik odnotowany w PR

## 4. Dokumentacja

- [x] 4.1 `docs/wdrozenie.md`: włączenie opcji, automatyczne pobieranie w WhatsAppie, `DOCUMENT_MODEL`; weryfikacja: `npm run spec:validate`
