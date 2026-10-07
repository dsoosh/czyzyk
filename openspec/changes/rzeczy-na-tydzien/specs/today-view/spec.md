## MODIFIED Requirements

### Requirement: Sekcje ekranu „Dziś i jutro”
Ekran główny SHALL pokazywać, w tej kolejności: rzeczy do przyniesienia na dziś, rzeczy do przyniesienia w ciągu najbliższych 7 dni (od jutra) posortowane po dacie z etykietą dnia, wydarzenia dziś i jutro oraz najbliższe w ciągu 7 dni, płatności z nadchodzącym lub minionym terminem, sprawy „wymaga odpowiedzi” z terminem. Pokazywane MUST być tylko elementy o statusie `active`. Pusta sekcja MUST mieć krótki komunikat zamiast znikać.

#### Scenario: Jutro bal
- **WHEN** istnieje aktywne wydarzenie „Bal” jutro i rzecz „przebranie” na jutro
- **THEN** ekran pokazuje „przebranie” z etykietą „jutro” w sekcji „W najbliższych dniach” i „Bal” w sekcji wydarzeń z etykietą „jutro”

#### Scenario: Pakowanie rano
- **WHEN** jest rano, a rzecz „przebranie” ma termin na dziś
- **THEN** ekran pokazuje „przebranie” w sekcji „Na dziś przynieść”

#### Scenario: Tydzień posortowany
- **WHEN** są rzeczy na pojutrze, na jutro i za 10 dni
- **THEN** sekcja „W najbliższych dniach” pokazuje najpierw rzecz na jutro, potem na pojutrze, a rzeczy za 10 dni nie pokazuje

#### Scenario: Element do przeglądu
- **WHEN** istnieje płatność o statusie `needs_review`
- **THEN** nie jest pokazywana na ekranie

#### Scenario: Nic do przyniesienia
- **WHEN** nie ma rzeczy do przyniesienia na dziś ani w najbliższych dniach
- **THEN** sekcje pokazują „Na dziś nic do przyniesienia” i „W najbliższych dniach nic do przyniesienia”

### Requirement: Odhaczanie rzeczy na ekranie głównym
Sekcje „Na dziś przynieść” i „W najbliższych dniach” SHALL być checklistami: stuknięcie oznacza rzecz jako spakowaną przez bieżącego użytkownika lub cofa oznaczenie; zmiana MUST być widoczna dla pozostałych członków rodziny najpóźniej po odświeżeniu ekranu.

#### Scenario: Pakowanie wieczorem
- **WHEN** użytkownik stuka „przebranie” na ekranie głównym
- **THEN** rzecz jest przekreślona z podpisem „spakowane przez Ciebie”, a drugi rodzic po odświeżeniu widzi „spakowane: Ola”
