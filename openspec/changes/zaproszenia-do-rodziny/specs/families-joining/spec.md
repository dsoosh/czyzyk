## Purpose

Zaproszenia do rodziny dla osób, które mają już konto w innej rodzinie.

## ADDED Requirements

### Requirement: Zaproszenie do rodziny
Dodanie przez rodzinę adresu należącego do innej rodziny SHALL tworzyć zaproszenie zamiast błędu. Zaproszony SHALL dostać powiadomienie push dokładnie raz i SHALL widzieć zaproszenie w aplikacji z nazwą zapraszającego. Przyjęcie SHALL przenosić zaproszonego do rodziny zapraszającego; odrzucenie SHALL usuwać zaproszenie. Tylko zaproszony MAY przyjąć albo odrzucić zaproszenie.

#### Scenario: Drugi rodzic z osobnym kontem
- **WHEN** Ola dodaje w „Moja rodzina” adres Marka, który ma już własną rodzinę, a Marek przyjmuje zaproszenie
- **THEN** Marek należy do rodziny Oli i widzi jej dzieci i sprawy

### Requirement: Scalenie rodziny przy przyjęciu
Gdy przyjmujący był jedyną osobą w swojej rodzinie, jego dzieci, znaczniki „zrobione” i sprawy rodziny SHALL przejść do nowej rodziny, a stara rodzina SHALL zostać usunięta. Dziecko o imieniu, które już jest w nowej rodzinie, MUST NOT być dublowane. Gdy w starej rodzinie zostają inne osoby, jej dane MUST pozostać bez zmian.

#### Scenario: To samo dziecko w obu rodzinach
- **WHEN** Marek był sam w rodzinie z dzieckiem Zosia, a rodzina Oli też ma Zosię i Marek przyjmuje zaproszenie
- **THEN** rodzina Oli ma jedną Zosię, a pozostałe dzieci Marka przechodzą do niej
