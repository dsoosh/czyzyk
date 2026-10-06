# Proposal

## Why

Model analizujący wiadomości nie wie nic o placówce: że „Baza” to siedziba w Golędzinowie, że są też lokale w Obornikach Śląskich i w Pęgowie, kto prowadzi fundację, jakie są grupy i w jakim wieku. Przez to gorzej rozpoznaje miejsca wydarzeń, osoby i grupy, a asystent „Zapytaj” nie odpowie na proste pytania o przedszkole.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** opis przedszkola (miejsca, prowadzący, grupy, kanały) jest zapisany w aplikacji, admin może go edytować w PWA, a ekstrakcja i asystent dostają go jako kontekst.

## What Changes

- Baza: tabela `kindergarten_profile` (jeden wiersz z opisem tekstowym), odczyt dla rodziny, zapis przez RPC `admin_update_kindergarten_profile` tylko dla admina; migracja wypełnia opis podstawowymi informacjami.
- Ekstrakcja: blok `<przedszkole>` w prompcie i zasada, by używać go do rozpoznawania miejsc („Baza”), osób i grup.
- Asystent „Zapytaj”: sekcja „O przedszkolu” w danych każdego widoku.
- PWA: zakładka **Admin → Przedszkole** z edycją opisu.

**Poza zakresem:** strukturalny model grup (wiek, klasa) w bazie, automatyczne pobieranie informacji ze strony przedszkola.

## Capabilities

### New Capabilities

- `kindergarten-profile`: opis placówki jako stały kontekst analizy wiadomości i asystenta.

### Modified Capabilities

(brak)

## Impact

- Migracja `0011_kindergarten_profile.sql`.
- `services/worker` (prompt, wczytanie), `services/api` (kontekst asystenta), `apps/pwa` (Admin → Przedszkole).
