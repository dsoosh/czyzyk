# Spec Delta

## Purpose

Zmniejsza porcję wiadomości w historii grupy, żeby nie trzeba było długo przewijać.

## ADDED Requirements

### Requirement: Porcje po 20 wiadomości
Historia grupy SHALL pokazywać 20 najnowszych wiadomości. Przycisk „Wcześniejsze wiadomości” SHALL doczytywać kolejne 20. Wymaganie zastępuje porcje po 50 z wymagania o historii wiadomości grupy.

#### Scenario: Otwarcie grupy
- **WHEN** grupa ma 120 wiadomości, a członek rodziny otwiera jej historię
- **THEN** widzi 20 najnowszych, a po „Wcześniejsze wiadomości” – 40 najnowszych
