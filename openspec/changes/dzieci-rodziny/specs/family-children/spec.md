## ADDED Requirements

### Requirement: Dzieci rodziny
PWA SHALL pozwalać członkom rodziny dodawać, edytować i usuwać dzieci (imię i opcjonalnie grupa ze śledzonych grup) w Ustawieniach, z przyciskiem „Dodaj dziecko”. Imiona MUST być unikalne w rodzinie bez rozróżniania wielkości liter. Zapis MUST odbywać się przez funkcje bazy dostępne tylko dla członków rodziny.

#### Scenario: Dodanie dziecka
- **WHEN** rodzic stuka „Dodaj dziecko”, wpisuje „Zosia” i wybiera grupę „Motylki”
- **THEN** Zosia pojawia się na liście dzieci z grupą Motylki u wszystkich członków rodziny

#### Scenario: Osoba spoza rodziny
- **WHEN** zalogowana osoba bez profilu rodziny wywołuje zapis dziecka
- **THEN** baza odrzuca żądanie

### Requirement: Przypisanie elementów do dziecka
Ekstrakcja SHALL otrzymywać listę dzieci rodziny z ich grupami i MAY wskazać przy wydarzeniu, rzeczy do przyniesienia, płatności lub sprawie imiona dzieci, których element dotyczy, gdy wiadomość wymienia konkretne dziecko. System MUST zapisywać tylko imiona z listy; pozostałe pomija bez odrzucania elementu.

#### Scenario: Wiadomość o konkretnym dziecku
- **WHEN** w grupie Motylki nauczycielka pisze „Zosia przynosi jutro kasztany”
- **THEN** rzecz do przyniesienia „kasztany” jest przypisana do Zosi

#### Scenario: Nieznane imię
- **WHEN** model wskaże imię spoza listy dzieci
- **THEN** element powstaje bez przypisania do dziecka

### Requirement: Imię dziecka przy elementach
PWA SHALL pokazywać przy elementach na ekranie Dziś i na Listach imiona przypisanych dzieci, a gdy element nie ma przypisania – imiona dzieci z grupy, z której pochodzi.

#### Scenario: Jedno dziecko w grupie
- **WHEN** Antek jest jedynym dzieckiem rodziny w grupie „Biedronki”, a z tej grupy pochodzi płatność bez przypisania
- **THEN** przy płatności widać „Antek”
