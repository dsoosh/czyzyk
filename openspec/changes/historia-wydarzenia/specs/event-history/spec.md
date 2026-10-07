## ADDED Requirements

### Requirement: Historia na ekranie wydarzenia
Ekran wydarzenia SHALL pokazywać historię w kolejności chronologicznej: wiadomości źródłowe wydarzenia, jego rzeczy do przyniesienia i wszystkich ich zmian, dokumenty dołączone do tych wiadomości oraz każdą zmianę wydarzenia i jego rzeczy do przyniesienia (utworzenie, zmienione pola przed → po, odwołanie) z uzasadnieniem. Wiadomości niezwiązane z wydarzeniem MUST NOT być pokazywane w historii.

#### Scenario: Przesunięta godzina
- **WHEN** wydarzenie utworzono z jednej wiadomości, a inna wiadomość przesunęła jego godzinę
- **THEN** historia pokazuje obie wiadomości i obie zmiany, z godziną przed i po zmianie

#### Scenario: Rzecz do przyniesienia
- **WHEN** do wydarzenia dopisano rzecz do przyniesienia na podstawie późniejszej wiadomości
- **THEN** ta wiadomość i utworzenie rzeczy są w historii wydarzenia

### Requirement: Zdjęcia dokumentów w historii
Historia SHALL pokazywać zdjęcie dokumentu dołączonego do wiadomości, gdy serwer je sprawdził i przechował, a w przeciwnym razie opis i tekst odczytany z dokumentu. Obraz MUST być wydawany wyłącznie członkom rodziny, pojedynczo, przez funkcję bazy; tabela z plikami MUST pozostać niedostępna bezpośrednio dla ról API. Obraz przed kontrolą serwera MUST NOT być wydawany.

#### Scenario: Plakat
- **WHEN** wydarzenie pochodzi z wiadomości ze zdjęciem plakatu, które przeszło kontrolę
- **THEN** w historii widać zdjęcie plakatu z jego opisem

#### Scenario: Osoba spoza rodziny
- **WHEN** osoba spoza rodziny prosi o obraz dokumentu
- **THEN** baza odmawia
