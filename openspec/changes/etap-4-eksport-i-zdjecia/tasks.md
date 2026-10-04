# Tasks

## 1. Magazyn i API

- [ ] 1.1 Migracja `0006_media.sql`: prywatne buckety `exports`, `media`, polityki Storage tylko dla `service_role`, kolumny `attachments`/`albums`, indeks pHash; weryfikacja: test, że `anon` i `authenticated` nie mogą czytać obiektów bucketów
- [ ] 1.2 `POST /ingest/export/upload-url` i `POST /ingest/export` (idempotentne po ścieżce); weryfikacja: testy API (401 bez tokenu, podwójna rejestracja = jedna paczka)
- [ ] 1.3 `GET /media/signed-url` dla członków rodziny (TTL ≤ 1 h); weryfikacja: test odrzucenia sesji bez profilu i sprawdzenia TTL

## 2. Android: eksport

- [ ] 2.1 Cel udostępniania `ACTION_SEND` dla ZIP, rozpoznanie grupy z nazwy pliku, odrzucenie nieśledzonej, kolejka uploadu; weryfikacja: test jednostkowy rozpoznawania nazwy (PL/EN) i ręczny test eksportu ręcznego
- [ ] 2.2 Wyzwalacze: lokalne powiadomienie (licznik / N godzin), przycisk, kafelek Szybkich ustawień, ustawienie N; weryfikacja: testy jednostkowe warunku wyzwalacza
- [ ] 2.3 `AccessibilityService` z maszyną stanów, selektorami i timeoutami, wymóg odblokowanego ekranu; weryfikacja: testy jednostkowe maszyny stanów na zapisanych drzewach widoków + ręczny test na telefonie
- [ ] 2.4 Raport błędu kroku z wersją WhatsAppa do `sync_log`; weryfikacja: test API przyjmującego raport i ręczne wymuszenie błędu

## 3. Import

- [ ] 3.1 Parser `_chat.txt` z fixtures PL i EN (wieloliniowe, systemowe, załączniki, 12/24 h); weryfikacja: testy na fixtures z prawdziwego eksportu
- [ ] 3.2 Import paczki: strumieniowe ZIP, scalanie (D4), zapis załączników, transakcja, usunięcie ZIP, `last_export_at`, natychmiastowa ekstrakcja; weryfikacja: testy na lokalnej bazie (scalanie z powiadomieniem, luka, podwójny import, uszkodzony ZIP)

## 4. Triaż i albumy

- [ ] 4.1 Miniatury i WebP (`sharp`), pHash i wykrywanie duplikatów; weryfikacja: testy na obrazach testowych (skompresowana kopia = duplikat, inne zdjęcie ≠ duplikat)
- [ ] 4.2 Zadanie `triage-image` z walidacją i ekstrakcją z dokumentów przez wspólny zapis operacji; weryfikacja: testy z atrapą modelu + rozszerzenie zestawu ewaluacyjnego o 5 obrazów (plan miesiąca, jadłospis, plakat, zdjęcie z zajęć, mem)
- [ ] 4.3 Grupowanie albumów (autor, ≤ 10 min) z tytułem i podpisem; weryfikacja: test kryterium „6 zdjęć w 4 minuty = jeden album”

## 5. PWA

- [ ] 5.1 Galeria: lista albumów, album, podgląd pełnoekranowy, podpisane URL-e; weryfikacja: testy komponentów
- [ ] 5.2 Widok źródła pokazuje obraz dokumentu; weryfikacja: test komponentu

## 6. Integracja

- [ ] 6.1 Weryfikacja kryterium etapu na produkcji: zdjęcie planu miesiąca → wydarzenia; seria zdjęć z zajęć → album z podpisem; wynik w PR
