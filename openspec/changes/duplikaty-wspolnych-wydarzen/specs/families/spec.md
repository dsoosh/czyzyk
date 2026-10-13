## Purpose

Wspólne wydarzenia kilku grup bez duplikatów i bez gubienia operacji przez nadmiarowe pola.

## ADDED Requirements

### Requirement: Bez duplikatów wspólnych wydarzeń
Gdy analiza tworzy wydarzenie, a inna grupa ma aktywne wydarzenie tego samego dnia w tym samym miejscu albo o tej samej nazwie (pomijając dopiski w nawiasach), system SHALL dołączyć grupę do istniejącego wydarzenia zamiast tworzyć nowe. Przyprowadzenie i plan dnia z nowej wiadomości SHALL uzupełnić puste pola tego wydarzenia, a rzeczy powiązane z tworzonym wydarzeniem SHALL wskazywać na nie.

#### Scenario: Wklejone ogłoszenie w drugiej grupie
- **WHEN** Wilki mają wycieczkę „Wycieczka do Centrum Historii Zajezdnia (bez Ogórka)” 14.10 w Centrum Historii Zajezdnia, a analiza Sów tworzy „Wycieczka do Centrum Historii Zajezdnia” 14.10 w tym samym miejscu
- **THEN** jest jedno wydarzenie z dołączoną grupą Sowy, bez duplikatu

### Requirement: Nadmiarowe pola nie odrzucają operacji
Pole, którego dany typ elementu nie ma, SHALL być pominięte z notatką w dzienniku wywołań, a reszta operacji SHALL zostać zapisana.

#### Scenario: Płatność z polem miejsca
- **WHEN** model zwraca płatność z polem `location`
- **THEN** płatność jest zapisana, a dziennik pokazuje „pominięto nieznane pola: location”

### Requirement: Płatności wydarzeń
Płatność dotycząca wydarzenia (np. koszt wycieczki) SHALL być z nim powiązana, a strona wydarzenia SHALL pokazywać jego płatności z kwotą i terminem.

#### Scenario: Koszt wycieczki
- **WHEN** ogłoszenie wycieczki podaje „koszt 80 zł”
- **THEN** płatność 80 zł jest powiązana z wycieczką i widoczna na stronie wydarzenia
