# Spec Delta

## Purpose

Przypomina rodzinie o tym, co ważne, w momencie, gdy można jeszcze zareagować: wieczorem przed dniem w przedszkolu i od razu przy pilnych zmianach.

## ADDED Requirements

### Requirement: Subskrypcja i ustawienia
Członek rodziny SHALL móc włączyć powiadomienia push na każdym swoim urządzeniu, wybrać godzinę wieczornego skrótu (domyślnie 19:00, strefa Europe/Warsaw) i wyłączyć poszczególne rodzaje alertów.

#### Scenario: Zmiana godziny skrótu
- **WHEN** użytkownik ustawia godzinę skrótu na 20:30
- **THEN** kolejne skróty przychodzą o 20:30

### Requirement: Wieczorny skrót
System SHALL wysyłać o wybranej godzinie skrót na jutro: rzeczy do przyniesienia, wydarzenia, płatności z terminem jutro i dzień wolny. Gdy na jutro nic nie ma, skrót MUST NOT być wysyłany. Każdy użytkownik MUST dostać najwyżej jeden skrót dziennie.

#### Scenario: Jutro strój i teatrzyk
- **WHEN** na jutro jest rzecz „strój sportowy” i płatność „10 zł na teatrzyk”
- **THEN** o 19:00 przychodzi powiadomienie „Jutro: strój sportowy, 10 zł na teatrzyk”, a stuknięcie otwiera „Dziś i jutro”

#### Scenario: Pusty dzień
- **WHEN** na jutro nie ma żadnych elementów
- **THEN** skrót nie jest wysyłany

### Requirement: Alerty natychmiastowe
System SHALL wysyłać alert natychmiast po pojawieniu się aktywnego dnia wolnego, nowej sprawy „wymaga odpowiedzi” oraz płatności z terminem na jutro. Ten sam element MUST NOT wywołać alertu tego samego rodzaju więcej niż raz.

#### Scenario: Nowy dzień wolny
- **WHEN** ekstrakcja tworzy aktywny dzień wolny 12.10
- **THEN** członkowie rodziny z włączonym alertem dostają „Przedszkole nieczynne 12.10 (dzień nauczyciela)”

### Requirement: Instrukcja dla iPhone'a
PWA SHALL wykrywać Safari na iOS bez instalacji na ekranie głównym i pokazywać instrukcję dodania aplikacji do ekranu głównego przed włączeniem powiadomień.

#### Scenario: iPhone w przeglądarce
- **WHEN** użytkownik iPhone'a w Safari stuka „Włącz powiadomienia”
- **THEN** widzi instrukcję „Udostępnij → Do ekranu początkowego” zamiast prośby o zgodę

### Requirement: Sprzątanie martwych subskrypcji
System SHALL usuwać subskrypcję, dla której usługa push zwraca błąd wygaśnięcia, oraz wszystkie subskrypcje osoby usuniętej z listy dozwolonych.

#### Scenario: Wygasła subskrypcja
- **WHEN** usługa push zwraca 410 dla subskrypcji
- **THEN** subskrypcja jest usuwana, a kolejne wysyłki jej nie dotyczą
