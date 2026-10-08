## ADDED Requirements

### Requirement: Zapłata z ekranu „Dziś”
Ekran „Dziś” SHALL pozwalać oznaczyć płatność jako zapłaconą jednym stuknięciem, z zapisem tego, kto i kiedy zapłacił, jak na liście płatności. Zapłacona płatność MUST zniknąć z „Dziś” i pozostać widoczna na liście zapłaconych, gdzie można cofnąć oznaczenie.

#### Scenario: Zapłata za wycieczkę
- **WHEN** członek rodziny zaznacza „zapłacone” przy płatności na ekranie „Dziś”
- **THEN** płatność znika z „Dziś”, a na liście płatności jest w sekcji „Zapłacone” z jego imieniem
