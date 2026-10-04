# Spec Delta

## Purpose

Wspólne dla całej rodziny listy rzeczy do przyniesienia, płatności, spraw do załatwienia i dni wolnych, na których każdy domownik może oznaczyć wykonanie, a pozostali widzą kto i kiedy to zrobił.

## ADDED Requirements

### Requirement: Lista rzeczy do przyniesienia
PWA SHALL pokazywać aktywne rzeczy do przyniesienia pogrupowane po dniu, z nadchodzącymi na górze, oraz dla spakowanych – kto i kiedy spakował.

#### Scenario: Spakowana rzecz
- **WHEN** Ola oznaczyła „przebranie” jako spakowane o 20:15
- **THEN** wszyscy członkowie rodziny widzą przy „przebranie” „spakowała Ola, 20:15”

### Requirement: Oznaczanie wykonania przez wąskie operacje
Członek rodziny SHALL móc oznaczyć rzecz jako spakowaną, płatność jako zapłaconą i sprawę jako załatwioną, a także cofnąć to oznaczenie. Operacja MUST zapisywać wyłącznie wykonawcę (bieżącego użytkownika) i czas, bez możliwości zmiany innych pól.

#### Scenario: Oznaczenie płatności
- **WHEN** członek rodziny oznacza „10 zł na teatrzyk” jako zapłacone
- **THEN** płatność ma status „zapłacone” z jego imieniem i czasem, widoczny dla wszystkich

#### Scenario: Cofnięcie oznaczenia
- **WHEN** członek rodziny cofa oznaczenie „zapłacone”
- **THEN** płatność wraca do stanu „do zapłaty”, a wykonawca i czas są wyczyszczone

#### Scenario: Osoba spoza rodziny wywołuje oznaczenie
- **WHEN** sesja bez profilu rodziny wywołuje oznaczenie płatności
- **THEN** operacja jest odrzucona z błędem uprawnień

### Requirement: Lista płatności
PWA SHALL pokazywać aktywne płatności z kwotą w złotych, terminem i statusem; płatności po terminie i niezapłacone MUST być wyróżnione.

#### Scenario: Płatność po terminie
- **WHEN** termin płatności minął, a nie jest oznaczona jako zapłacona
- **THEN** jest na górze listy z wyróżnieniem „po terminie”

### Requirement: Lista spraw „wymaga odpowiedzi”
PWA SHALL pokazywać aktywne pytania do rodziców z terminem i oznaczeniem „załatwione”; załatwione MUST być przenoszone do zwijanej sekcji.

#### Scenario: Zgoda na wycieczkę
- **WHEN** istnieje sprawa „Zgoda na wycieczkę do 15.10” i nikt jej nie załatwił
- **THEN** jest widoczna w sekcji otwartych spraw z terminem 15.10

### Requirement: Lista dni wolnych
PWA SHALL pokazywać nadchodzące dni wolne przedszkola z zakresem dat i powodem.

#### Scenario: Przerwa świąteczna
- **WHEN** istnieje dzień wolny od 23.12 do 1.01 z powodem „przerwa świąteczna”
- **THEN** lista pokazuje „23.12–1.01 · przerwa świąteczna”
