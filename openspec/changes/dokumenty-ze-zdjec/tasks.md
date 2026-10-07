# Tasks

## 1. Parser i baza

- [ ] 1.1 Parser eksportu zwraca nazwy plików załączników; weryfikacja: testy jednostkowe (PL/EN, Android/iOS)
- [ ] 1.2 Migracja `0018_documents.sql` (kolumny `attachments`, `attachment_files` z RLS bez polityk); weryfikacja: test, że `authenticated` nie czyta `attachment_files`, test RLS wszystkich tabel

## 2. API

- [ ] 2.1 `POST /import/chat` z dokumentami (łączenie po nazwie pliku, tylko JPEG, `sha256`, ponowna ekstrakcja, liczby w `sync_log`); weryfikacja: testy na lokalnej bazie

## 3. Worker

- [ ] 3.1 Kontrola zapasowa dokumentów przed ekstrakcją (`DOCUMENT_MODEL`, ludzie lub odmowa → usunięcie obrazu); weryfikacja: testy z atrapą modelu na lokalnej bazie
- [ ] 3.2 Tekst dokumentu w prompcie ekstrakcji; weryfikacja: test promptu

## 4. Android

- [ ] 4.1 `ScreeningRule` (reguła D1) i wybór obrazów z czatu; weryfikacja: testy jednostkowe
- [ ] 4.2 ML Kit z modelami w APK, skalowanie i JPEG bez EXIF, postęp, przekazanie dokumentów przez most; weryfikacja: build release w CI, ręczny test na telefonie

## 5. PWA

- [ ] 5.1 Import wysyła dokumenty z Czyżyk Connect i pokazuje podsumowanie decyzji; weryfikacja: testy komponentu

## 6. Dokumentacja

- [ ] 6.1 `docs/wdrozenie.md`: eksport z multimediami do Czyżyk Connect, `DOCUMENT_MODEL`; weryfikacja: `npm run spec:validate`
