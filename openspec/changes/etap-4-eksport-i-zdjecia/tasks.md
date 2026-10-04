# Tasks

## 1. Magazyn i API

- [ ] 1.1 Migracja `0006_media.sql`: prywatne buckety `exports`, `media`, polityki Storage tylko dla `service_role`, kolumny `attachments.screening`/`ocr_text`/`sha256`; weryfikacja: test, że `anon` i `authenticated` nie mogą czytać obiektów bucketów
- [ ] 1.2 `POST /ingest/export/upload-url` i `POST /ingest/export` (idempotentne po ścieżce); weryfikacja: testy API (401 bez tokenu, podwójna rejestracja = jedna paczka)
- [ ] 1.3 `GET /media/signed-url` dla członków rodziny (TTL ≤ 1 h, tylko dokumenty); weryfikacja: test odrzucenia sesji bez profilu i sprawdzenia TTL

## 2. Android: kontrola obrazów

- [ ] 2.1 Moduł kontroli z modelami ML Kit dołączonymi do APK i regułą D2 (`image` / `text_only` / `withheld`, domyślnie `withheld`); weryfikacja: testy instrumentalne na zestawie regresji ok. 40 obrazów – żadne zdjęcie z ludźmi nie dostaje `image`, wynik raportowany w PR
- [ ] 2.2 Analiza PDF strona po stronie; weryfikacja: test z PDF zawierającym zdjęcie na jednej stronie (wysyłany tylko tekst)
- [ ] 2.3 Budowa paczki przefiltrowanej (strumieniowo, manifest, rejestr `sha256`, kasowanie oryginału i plików tymczasowych); weryfikacja: test jednostkowy – paczka nie zawiera plików `withheld` ani `text_only`, manifest `withheld` bez treści, katalog tymczasowy pusty po zakończeniu
- [ ] 2.4 Weryfikacja braku ruchu sieciowego podczas analizy; weryfikacja: test w trybie samolotowym oraz przegląd zależności APK (brak wariantów ML Kit pobieranych przez Play Services)
- [ ] 2.5 Ekran podsumowania eksportu i podgląd wysłanych obrazów; weryfikacja: ręczny test na telefonie

## 3. Android: eksport

- [ ] 3.1 Cel udostępniania `ACTION_SEND` dla ZIP, rozpoznanie grupy z nazwy pliku, odrzucenie i usunięcie nieśledzonej, kolejka uploadu paczki przefiltrowanej; weryfikacja: test jednostkowy rozpoznawania nazwy (PL/EN) i ręczny test eksportu ręcznego
- [ ] 3.2 Wyzwalacze: lokalne powiadomienie (licznik / N godzin), przycisk, kafelek Szybkich ustawień, ustawienie N; weryfikacja: testy jednostkowe warunku wyzwalacza
- [ ] 3.3 `AccessibilityService` z maszyną stanów, selektorami i timeoutami, wymóg odblokowanego ekranu; weryfikacja: testy jednostkowe maszyny stanów na zapisanych drzewach widoków + ręczny test na telefonie
- [ ] 3.4 Raport błędu kroku z wersją WhatsAppa do `sync_log`; weryfikacja: test API przyjmującego raport i ręczne wymuszenie błędu

## 4. Import

- [ ] 4.1 Parser `_chat.txt` z fixtures PL i EN (wieloliniowe, systemowe, załączniki, 12/24 h); weryfikacja: testy na fixtures z prawdziwego eksportu
- [ ] 4.2 Import paczki: manifest (odrzucenie plików spoza `image`, błąd przy braku manifestu), scalanie (D5), zapis dokumentów, transakcja, usunięcie paczki, `last_export_at`, natychmiastowa ekstrakcja; weryfikacja: testy na lokalnej bazie (scalanie z powiadomieniem, luka, `withheld` bez pliku, plik spoza manifestu, podwójny import, uszkodzony ZIP)

## 5. Ekstrakcja z dokumentów

- [ ] 5.1 Zadanie `extract-document` (obraz przez model z wizją, `text_only` przez ścieżkę tekstową), opis dokumentu, miniatura WebP, deduplikacja `sha256`; weryfikacja: testy z atrapą modelu + rozszerzenie zestawu ewaluacyjnego o 5 dokumentów (plan miesiąca, jadłospis, plakat, ogłoszenie, plakat jako tekst)
- [ ] 5.2 Kontrola zapasowa `contains_people` (usunięcie obrazu i miniatury, wpis w `sync_log`); weryfikacja: test z atrapą modelu zgłaszającą ludzi – obiekt znika z bucketu, tekst zostaje
- [ ] 5.3 Widok źródła pokazuje obraz dokumentu lub jego tekst; weryfikacja: test komponentu dla obu wariantów

## 6. Integracja

- [ ] 6.1 Weryfikacja kryterium etapu na prawdziwym eksporcie: zdjęcie planu miesiąca → wydarzenia; w buckecie `media` i w bazie nie ma żadnego zdjęcia z zajęć ani jego opisu; wynik w PR
