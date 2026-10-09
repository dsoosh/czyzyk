# Spec Delta

## Purpose

Pozwala adminowi usunąć błędne lub zdublowane wydarzenie.

## ADDED Requirements

### Requirement: Admin usuwa wydarzenie
Admin SHALL móc usunąć wydarzenie przyciskiem na stronie wydarzenia, po potwierdzeniu. Usunięcie SHALL kasować wydarzenie i jego historię zmian, a rzeczy do przyniesienia SHALL zostać bez powiązania z nim. Usunięcie MUST być możliwe wyłącznie przez funkcję bazy sprawdzającą rolę admina. Członek rodziny bez roli admina MUST NOT widzieć przycisku ani móc usunąć wydarzenia.

#### Scenario: Zdublowane wydarzenie
- **WHEN** admin otwiera zdublowane wydarzenie, wybiera „Usuń wydarzenie” i potwierdza
- **THEN** wydarzenie znika z kalendarza, a aplikacja wraca do kalendarza

#### Scenario: Członek rodziny
- **WHEN** członek rodziny bez roli admina otwiera wydarzenie
- **THEN** nie widzi przycisku usuwania, a wywołanie funkcji usuwania kończy się odmową
