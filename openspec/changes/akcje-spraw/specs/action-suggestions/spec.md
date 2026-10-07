## ADDED Requirements

### Requirement: Akcje dopasowane do sprawy
Analiza wiadomości SHALL proponować do każdej sprawy „wymaga odpowiedzi” od 1 do 4 akcji z zestawu: do przyniesienia, do zapłaty, do kalendarza, odpowiedź, zrobione, nie dotyczy – dopasowanych do treści sprawy, z krótkimi etykietami po polsku. Pytanie o udział MUST NOT dostać akcji „do przyniesienia”, a prośba o przyniesienie rzeczy MUST NOT dostać akcji „odpowiedź”.

#### Scenario: Spray
- **WHEN** sprawa brzmi „Zakup i doniesienie sprayu przeciwko insektom”
- **THEN** proponowane akcje to m.in. „Do przyniesienia” i „Zrobione”

#### Scenario: Zajęcia szachowe
- **WHEN** sprawa brzmi „Czy Elena chce wziąć udział w zajęciach szachowych od 6.10.2026?”
- **THEN** proponowane akcje to odpowiedzi, np. „Tak, zapisujemy” i „Nie”, bez „Do przyniesienia”

### Requirement: Uzupełnianie propozycji istniejących spraw
Otwarta sprawa bez propozycji SHALL dostać je przy najbliższej analizie wiadomości jej grupy (np. po „Analizuj ponownie”). Uzupełnienie MUST NOT zmieniać statusu, pewności ani decyzji admina o sprawie.

#### Scenario: Sprawa sprzed zmiany
- **WHEN** admin wysyła do ponownej analizy wiadomość o sprayu, a sprawa „Zakup sprayu” istnieje bez propozycji
- **THEN** sprawa dostaje akcje, np. „Do przyniesienia”, i pozostaje aktywna

### Requirement: Wykonanie akcji jednym stuknięciem
Członek rodziny SHALL móc wybrać proponowaną akcję otwartej sprawy. „Do przyniesienia”, „do zapłaty” i „do kalendarza” MUST utworzyć odpowiedni element z grupą, dziećmi i wiadomościami źródłowymi sprawy; każda akcja MUST zamknąć sprawę z adnotacją (etykietą wybranej akcji). Cofnięcie „załatwione” MUST usunąć adnotację.

#### Scenario: Przeniesienie do rzeczy
- **WHEN** rodzic stuka „Do przyniesienia” przy sprawie sprayu dla Eleny z terminem 6.10
- **THEN** na liście rzeczy do przyniesienia pojawia się „spray przeciwko insektom” na 6.10 przypisany do Eleny, a sprawa jest załatwiona z adnotacją „Do przyniesienia”

#### Scenario: Odpowiedź
- **WHEN** rodzic stuka „Tak, zapisujemy” przy pytaniu o szachy
- **THEN** sprawa jest załatwiona z adnotacją „Tak, zapisujemy”
