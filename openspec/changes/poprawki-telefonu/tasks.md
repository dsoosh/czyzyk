# Tasks

## 1. Nazwy grup

- [x] 1.1 `normalizeGroupName` w `packages/shared` i w schemacie ingestu; weryfikacja: testy jednostkowe (U+2068/2069, NFD → NFC, spacje)
- [x] 1.2 Migracja `0012_group_name_normalization.sql` (funkcja, scalanie, normalizacja nazw); weryfikacja: test bazy scalania (wiadomości, elementy, dzieci, tracked, display_name)
- [x] 1.3 Normalizacja na telefonie (parser powiadomień); weryfikacja: test jednostkowy Kotlin w CI

## 2. Udostępnianie eksportu

- [x] 2.1 Android: intent `SEND`/`SEND_MULTIPLE`, wybór i odczyt czatu (ZIP strumieniowo, limit), most `takeSharedChat`, otwarcie importu; weryfikacja: testy jednostkowe wyboru i odczytu ZIP w CI
- [x] 2.2 PWA: ImportPage przyjmuje czat z mostu; weryfikacja: test komponentu
