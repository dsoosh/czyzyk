# Spec Delta

## ADDED Requirements

### Requirement: Odhaczanie rzeczy na ekranie głównym
Sekcja „Na jutro przynieść” SHALL być checklistą: stuknięcie oznacza rzecz jako spakowaną przez bieżącego użytkownika lub cofa oznaczenie; zmiana MUST być widoczna dla pozostałych członków rodziny najpóźniej po odświeżeniu ekranu.

#### Scenario: Pakowanie wieczorem
- **WHEN** użytkownik stuka „przebranie” na ekranie głównym
- **THEN** rzecz jest przekreślona z podpisem „spakowane przez Ciebie”, a drugi rodzic po odświeżeniu widzi „spakowane: Ola”
