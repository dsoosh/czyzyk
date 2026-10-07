## ADDED Requirements

### Requirement: Operacja utworzenia bez lokalnego identyfikatora
Operacja utworzenia elementu SHALL być przyjmowana bez pola `ref`; brak pola MUST znaczyć to samo co `ref: null`. Lokalny identyfikator MUST być wymagany tylko wtedy, gdy inna operacja w tej samej odpowiedzi się do niego odwołuje.

#### Scenario: Płatność obok nowego wydarzenia
- **WHEN** model tworzy wydarzenie z `ref: "nowe1"` i płatność bez pola `ref`
- **THEN** obie operacje są zapisane, a płatność widać na liście płatności
