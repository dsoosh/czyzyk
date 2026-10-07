# Spec Delta

## Purpose

Na telefonie, przed wysyłką, odróżnia dokumenty organizacyjne od zdjęć ludzi w eksporcie czatu udostępnionym do Czyżyk Connect, tak aby zdjęcia dzieci nigdy nie opuściły telefonu.

## ADDED Requirements

### Requirement: Kontrola obrazów z udostępnionego eksportu na telefonie
Gdy do Czyżyk Connect udostępniono ZIP eksportu z multimediami, aplikacja SHALL sprawdzić lokalnie każdy obraz wymieniony w pliku czatu modelami dołączonymi do aplikacji. Obraz MUST NOT być wysyłany do żadnej usługi w celu tej kontroli.

#### Scenario: Eksport ze zdjęciami
- **WHEN** użytkownik udostępnia do Czyżyk Connect eksport z multimediami
- **THEN** aplikacja pokazuje postęp sprawdzania zdjęć, a potem otwiera import z podsumowaniem decyzji

### Requirement: Trzy decyzje, domyślnie wstrzymaj
Każdy obraz SHALL dostać decyzję: `image` (czytelny tekst, brak ludzi – wysyłany obraz i tekst), `text_only` (czytelny tekst i wykryta twarz lub osoba – wysyłany tylko tekst rozpoznany na telefonie) albo `withheld` (nic nie jest wysyłane). Błąd analizy, obraz mniejszy niż 400 px, brak czytelnego tekstu, przekroczony limit liczby obrazów, filmy, PDF-y i inne pliki MUST dawać `withheld`. Wykrycie twarzy lub osoby MUST wykluczać `image`.

#### Scenario: Zdjęcie jadłospisu
- **WHEN** obraz to sfotografowany jadłospis bez ludzi
- **THEN** decyzja to `image`

#### Scenario: Plakat ze zdjęciem dzieci
- **WHEN** obraz to plakat „Bal jesienny 24.10” ze zdjęciem dzieci
- **THEN** decyzja to `text_only` i wysyłany jest tylko tekst plakatu

#### Scenario: Zdjęcie z zajęć
- **WHEN** obraz przedstawia dzieci bez czytelnego tekstu
- **THEN** decyzja to `withheld` i nic z tego obrazu nie opuszcza telefonu

### Requirement: Obraz dokumentu bez metadanych
Obraz z decyzją `image` SHALL być wysyłany jako nowo zakodowany JPEG o dłuższym boku najwyżej 2048 px, bez metadanych oryginału (w tym lokalizacji).

#### Scenario: Zdjęcie z lokalizacją GPS
- **WHEN** dokument ma w EXIF współrzędne GPS
- **THEN** wysłany obraz nie zawiera EXIF
