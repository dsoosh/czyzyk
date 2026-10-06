# Tasks

## 1. Baza

- [x] 1.1 Migracja `0011_kindergarten_profile.sql` z opisem startowym, RLS i RPC admina; weryfikacja: testy bazy (rodzina czyta, admin zapisuje, rodzina bez admina i anonim odrzuceni, limit długości)

## 2. Ekstrakcja i asystent

- [x] 2.1 Blok `<przedszkole>` w prompcie ekstrakcji i zasada użycia; weryfikacja: test promptu (snapshot) i test bazy `loadBatch`
- [x] 2.2 Sekcja „O przedszkolu” w kontekście asystenta; weryfikacja: test bazy kontekstu

## 3. PWA

- [x] 3.1 Admin → Przedszkole (edycja opisu); weryfikacja: testy komponentu (zapis przez RPC, licznik znaków)
