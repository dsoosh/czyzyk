# Spec Delta

## ADDED Requirements

### Requirement: Model Claude dla wszystkich wywołań
Konfiguracja produkcyjna SHALL ustawiać ten sam model Claude (Haiku 5.5) dla analizy wiadomości, triażu, kontroli zdjęć dokumentów i asystenta „Zapytaj”. Nazwy modeli MUST pozostać wyłącznie w konfiguracji.

#### Scenario: Analiza po wdrożeniu konfiguracji
- **WHEN** worker analizuje nowe wiadomości po wdrożeniu konfiguracji
- **THEN** panel LLM pokazuje przy wywołaniu model `claude-haiku-5-5`
