# Spec Delta

## Purpose

Zbiera w jednym miejscu stałe informacje o przedszkolu – godziny, osoby, kontakty – aktualizowane automatycznie z rozmów i poprawiane ręcznie przez rodzinę.

## ADDED Requirements

### Requirement: Ekran ściągawki
PWA SHALL pokazywać aktywne fakty pogrupowane w kategorie: godziny, kontakt, osoba, inne, z linkiem do źródła dla faktów automatycznych.

#### Scenario: Godziny otwarcia
- **WHEN** ekstrakcja zapisała fakt „Godziny otwarcia: 6:30–17:00”
- **THEN** ściągawka pokazuje go w kategorii „Godziny” z linkiem „skąd to wiem”

### Requirement: Edycja ręczna
Członek rodziny SHALL móc dodać, poprawić i usunąć fakt. Fakt zmieniony ręcznie MUST być oznaczony jako ręczny i MUST NOT być nadpisywany przez ekstrakcję; propozycja zmiany z ekstrakcji trafia wtedy do kolejki przeglądu.

#### Scenario: Poprawka numeru telefonu
- **WHEN** członek rodziny poprawia numer sekretariatu
- **THEN** fakt pokazuje nowy numer z oznaczeniem „edytowane ręcznie”, a kolejna ekstrakcja go nie zmienia

#### Scenario: Osoba spoza rodziny
- **WHEN** sesja bez profilu rodziny próbuje edytować fakt
- **THEN** operacja jest odrzucona z błędem uprawnień
