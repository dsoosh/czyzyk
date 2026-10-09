# Spec Delta

## Purpose

Jedna analiza grupy dla wszystkich rodzin: adresaci spraw zamiast filtrowania „naszych” dzieci, przypisanie i widoczność liczone dla każdej rodziny.

## ADDED Requirements

### Requirement: Analiza grupy niezależna od rodziny
Analiza wiadomości grupy SHALL być jednym wywołaniem modelu, niezależnie od liczby rodzin. Prompt systemowy MUST NOT zawierać dzieci ani członków rodzin. Model SHALL zapisywać przy sprawie imiona wymienionych dzieci w mianowniku (adresaci), a pustą listę, gdy sprawa dotyczy całej grupy. Analiza MUST NOT pomijać sprawy dlatego, że wymienione dziecko nie należy do żadnej rodziny.

#### Scenario: Lista imion
- **WHEN** nauczycielka pisze „Antek, Hania i Lena przynoszą jutro kasztany”
- **THEN** powstaje jedna rzecz do przyniesienia z adresatami „Antek”, „Hania”, „Lena”

### Requirement: Przypisanie dzieci i widoczność dla rodziny
Baza SHALL przypisywać sprawę do dzieci z jej grup, których imię lub inna forma imienia pasuje do adresata. Rodzina SHALL widzieć sprawę, gdy widzi jej grupę lub dodatkową grupę oraz sprawa nie ma adresatów albo dotyczy jej dziecka. Przypisanie SHALL być przeliczane po analizie oraz po dodaniu, zmianie i usunięciu dziecka.

#### Scenario: Dziecko dodane później
- **WHEN** w grupie jest rzecz do przyniesienia dla „Lena”, a rodzina dodaje dziecko Lena w tej grupie
- **THEN** rzecz od razu pojawia się u tej rodziny z przypisaną Leną

#### Scenario: Sprawa cudzego dziecka
- **WHEN** w grupie jest płatność tylko dla „Antek”, a dziecko rodziny to Zosia
- **THEN** rodzina nie widzi tej płatności, a rodzina Antka widzi

### Requirement: Odpowiedź rodziny zamyka sprawę tylko dla niej
Wiadomość autora należącego do rodziny korzystającej z aplikacji SHALL mieć w zapytaniu znacznik tej rodziny. Gdy taka wiadomość odpowiada na sprawę albo potwierdza jej wykonanie, analiza SHALL oznaczyć sprawę jako zrobioną tylko dla tej rodziny. Stan innych rodzin MUST pozostać bez zmian.

#### Scenario: Zapisujemy
- **WHEN** mama z rodziny R1 odpisuje w grupie „Zapisujemy Zosię” na sprawę „Zapisy na basen”
- **THEN** sprawa jest odpowiedziana w rodzinie R1, a u innych rodzin dalej czeka na odpowiedź

### Requirement: Podpowiedź dodania dziecka
Gdy rodzina zalogowanego użytkownika nie ma żadnego dziecka, ekran „Dziś” SHALL pokazywać podpowiedź z odnośnikiem otwierającym w ustawieniach formularz nowego dziecka. Podpowiedź MUST znikać po dodaniu pierwszego dziecka.

#### Scenario: Pierwsze logowanie
- **WHEN** użytkownik loguje się po raz pierwszy, a jego rodzina nie ma dzieci
- **THEN** na ekranie „Dziś” widzi podpowiedź „Dodaj swoje dziecko”, a odnośnik otwiera formularz „Nowe dziecko”
