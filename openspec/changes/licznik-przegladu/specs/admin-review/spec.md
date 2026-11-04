# Spec Delta

## ADDED Requirements

### Requirement: Czytelny licznik przeglądu
Licznik elementów do przejrzenia przy „Admin” SHALL mieć opis „N do przejrzenia w Przeglądzie”, a zakładka „Przegląd” MUST pokazywać ten sam licznik. Gdy coś czeka na przegląd, „Admin” SHALL otwierać kolejkę przeglądu.

#### Scenario: Jeden element w kolejce
- **WHEN** w kolejce przeglądu czeka jeden element
- **THEN** przy „Admin” jest „1” z opisem „1 do przejrzenia w Przeglądzie”, zakładka „Przegląd” też pokazuje „1”, a kliknięcie „Admin” otwiera „Do przejrzenia”

#### Scenario: Pusta kolejka
- **WHEN** nic nie czeka na przegląd
- **THEN** licznika nie ma, a „Admin” otwiera „Rodzinę”
