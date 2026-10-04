# Spec Delta

## Purpose

Daje adminowi kontrolę nad elementami, których model nie był pewien, aby błędna ekstrakcja nie trafiła do rodziny, a trafna nie zginęła.

## ADDED Requirements

### Requirement: Kolejka elementów do przeglądu
Panel admina SHALL pokazywać wszystkie elementy o statusie `needs_review` wraz z typem, proponowanymi danymi, pewnością, uzasadnieniem i wiadomościami źródłowymi. Liczba elementów w kolejce MUST być widoczna na zakładce „Admin”.

#### Scenario: Nowy element w kolejce
- **WHEN** ekstrakcja tworzy płatność z pewnością 0,5
- **THEN** admin widzi ją w kolejce, a zakładka „Admin” pokazuje licznik 1

### Requirement: Zatwierdzenie, poprawa i odrzucenie
Admin SHALL móc zatwierdzić element (status `active`), poprawić jego pola przed zatwierdzeniem albo odrzucić go (status `cancelled`). Decyzja MUST zapisać, kto i kiedy jej dokonał. Operacje MUST być dostępne wyłącznie dla roli `admin`.

#### Scenario: Poprawienie daty
- **WHEN** admin zmienia datę wydarzenia z 9.10 na 16.10 i zatwierdza
- **THEN** wydarzenie jest aktywne z datą 16.10 i pojawia się w kalendarzu

#### Scenario: Odrzucenie
- **WHEN** admin odrzuca element
- **THEN** element ma status `cancelled` i nie pojawia się na żadnym ekranie

#### Scenario: Członek rodziny próbuje zatwierdzić
- **WHEN** użytkownik z rolą `family` wywołuje zatwierdzenie
- **THEN** operacja jest odrzucona z błędem uprawnień

### Requirement: Ochrona decyzji przed nadpisaniem
Element zatwierdzony lub poprawiony przez admina SHALL NOT być zmieniany przez kolejną ekstrakcję z pewnością poniżej progu; zmiana o wysokiej pewności MUST trafić ponownie do kolejki zamiast nadpisać decyzję.

#### Scenario: Ekstrakcja po ręcznej poprawie
- **WHEN** admin poprawił datę wydarzenia, a nowa ekstrakcja proponuje inną datę
- **THEN** wydarzenie zachowuje datę admina, a propozycja trafia do kolejki przeglądu
