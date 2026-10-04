# Spec Delta

## Purpose

Umożliwia odnalezienie w historii grup wiadomości i zdjęć pasujących do pytania – zarówno po dokładnych słowach, jak i po znaczeniu.

## ADDED Requirements

### Requirement: Indeksowanie treści
Każda wiadomość z treścią i każdy podpis zdjęcia SHALL zostać zaindeksowany do wyszukiwania semantycznego najpóźniej 10 minut po zapisie; istniejąca historia MUST zostać zaindeksowana wstecznie. Błąd indeksowania MUST być ponawiany bez blokowania pozostałych wiadomości.

#### Scenario: Nowa wiadomość
- **WHEN** zapisana zostaje wiadomość „Pasowanie na przedszkolaka 14 listopada o 10:00”
- **THEN** w ciągu 10 minut można ją znaleźć zapytaniem semantycznym

### Requirement: Wyszukiwanie hybrydowe
Wyszukiwanie SHALL łączyć dopasowanie semantyczne i tekstowe (odporne na literówki i odmianę) i zwracać wiadomości z grupą, autorem, czasem i oceną trafności. Wyszukiwanie MUST pomijać wiadomości o statusie innym niż `active` i być dostępne wyłącznie dla członków rodziny.

#### Scenario: Pytanie innymi słowami
- **WHEN** szukam „uroczystość przyjęcia do przedszkola”
- **THEN** wiadomość o „pasowaniu na przedszkolaka” jest w pierwszych 5 wynikach

#### Scenario: Literówka
- **WHEN** szukam „wycieczk do zoo”
- **THEN** wiadomości o wycieczce do ZOO są w wynikach

#### Scenario: Osoba spoza rodziny
- **WHEN** sesja bez profilu rodziny wywołuje wyszukiwanie
- **THEN** otrzymuje pusty wynik
