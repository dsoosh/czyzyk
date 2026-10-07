## ADDED Requirements

### Requirement: Unikalny kolor dziecka
Każde dziecko SHALL mieć kolor z ustalonej palety, wybierany przez członka rodziny w ustawieniach. Kolor MUST być unikalny wśród dzieci rodziny. Nowe dziecko bez wybranego koloru SHALL dostać pierwszy wolny kolor, a zapis dziecka bez koloru MUST zostawić jego dotychczasowy kolor.

#### Scenario: Wybór koloru
- **WHEN** członek rodziny wybiera dla Zosi kolor fioletowy
- **THEN** Zosia ma kolor fioletowy, a dla pozostałych dzieci fioletowy jest niedostępny

#### Scenario: Zajęty kolor
- **WHEN** ktoś próbuje nadać dziecku kolor, który ma już inne dziecko
- **THEN** system odrzuca zapis z komunikatem „Ten kolor ma już inne dziecko.”

### Requirement: Etykiety dzieci w kolorach
Etykieta dziecka przy sprawie (rzecz do przyniesienia, wydarzenie, płatność, sprawa wymagająca odpowiedzi) SHALL mieć kolor tego dziecka; sprawa kilku dzieci MUST mieć osobną etykietę dla każdego z nich.

#### Scenario: Dwoje dzieci
- **WHEN** rzecz do przyniesienia dotyczy Zosi i Antka
- **THEN** przy rzeczy widać dwie etykiety, każdą w kolorze dziecka
