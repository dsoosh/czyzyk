## Purpose

Sprawy „wymaga odpowiedzi” tylko dla decyzji i działań rodzin.

## ADDED Requirements

### Requirement: Sprawy wymagające odpowiedzi tylko dla rodzin
Analiza SHALL tworzyć sprawę „wymaga odpowiedzi” tylko wtedy, gdy rodzina musi coś odpowiedzieć, zdecydować, zadeklarować albo zrobić. Gdy pytanie albo decyzja należy do przedszkola, kadry lub organizatora, analiza MUST NOT tworzyć takiej sprawy. Zamiast tego SHALL zaktualizować powiązane wydarzenie o to, co się zmieniło.

#### Scenario: Przekazany mail do organizatora
- **WHEN** nauczycielka przesyła mail „czy chcieliby Państwo przenieść rezerwację, czy ją anulować?” i pisze „Ustalę z resztą kadry co robimy i dam znać”
- **THEN** analiza aktualizuje wydarzenie wycieczki i nie tworzy sprawy „wymaga odpowiedzi”
