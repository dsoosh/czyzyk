# Spec Delta

## Purpose

Ekran główny PWA, który w kilka sekund odpowiada rodzicowi na pytanie „co jest dziś i jutro w przedszkolu i o czym muszę pamiętać”.

## ADDED Requirements

### Requirement: Sekcje ekranu „Dziś i jutro”
Ekran główny SHALL pokazywać, w tej kolejności: rzeczy do przyniesienia na jutro, wydarzenia dziś i jutro oraz najbliższe w ciągu 7 dni, płatności z nadchodzącym lub minionym terminem, sprawy „wymaga odpowiedzi” z terminem. Pokazywane MUST być tylko elementy o statusie `active`. Pusta sekcja MUST mieć krótki komunikat zamiast znikać.

#### Scenario: Jutro bal
- **WHEN** istnieje aktywne wydarzenie „Bal” jutro i rzecz „przebranie” na jutro
- **THEN** ekran pokazuje „przebranie” w sekcji „Na jutro przynieść” i „Bal” w sekcji wydarzeń z etykietą „jutro”

#### Scenario: Element do przeglądu
- **WHEN** istnieje płatność o statusie `needs_review`
- **THEN** nie jest pokazywana na ekranie

#### Scenario: Nic na jutro
- **WHEN** nie ma rzeczy do przyniesienia na jutro
- **THEN** sekcja pokazuje „Na jutro nic do przyniesienia”

### Requirement: Baner zbliżającego się dnia wolnego
Ekran główny SHALL wyświetlać wyraźny baner, gdy dzień wolny przedszkola zaczyna się w ciągu najbliższych 7 dni lub trwa.

#### Scenario: Dzień wolny w poniedziałek
- **WHEN** jest czwartek, a w poniedziałek przedszkole jest zamknięte z powodu „dzień nauczyciela”
- **THEN** na górze ekranu widać baner „Poniedziałek 12.10 – przedszkole nieczynne (dzień nauczyciela)”

### Requirement: Czas lokalny i odświeżanie
Ekran SHALL wyznaczać „dziś” i „jutro” w strefie Europe/Warsaw i odświeżać dane przy powrocie aplikacji na pierwszy plan.

#### Scenario: Powrót do aplikacji po północy
- **WHEN** aplikacja była otwarta wieczorem i wraca na pierwszy plan po północy
- **THEN** sekcje „dziś” i „jutro” odpowiadają nowemu dniu

### Requirement: Nazwa grupy przy elemencie
Każdy element powiązany z grupą SHALL pokazywać nazwę wyświetlaną grupy; elementy bez grupy oznaczone są jako „całe przedszkole”.

#### Scenario: Wydarzenie dla całego przedszkola
- **WHEN** wydarzenie nie ma przypisanej grupy
- **THEN** jest oznaczone etykietą „całe przedszkole”
