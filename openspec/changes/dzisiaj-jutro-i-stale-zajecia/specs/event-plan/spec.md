## Purpose

Stałe zajęcia w czasie pobytu, zapisy i ankiety, ekran dnia i tagi miejsc.

## ADDED Requirements

### Requirement: Stałe zajęcia w czasie pobytu w przedszkolu
Analiza SHALL oznaczać cotygodniowe zajęcia w czasie pobytu w przedszkolu, które nie wymagają nic od rodziców, jako stałe zajęcia. Takie wydarzenia MUST NOT pojawiać się w dniach kalendarza, na ekranie głównym, w skrótach push ani w kalendarzu subskrybowanym. Kalendarz SHALL wymieniać je w osobnej, zwiniętej liście.

#### Scenario: Dodatkowy angielski
- **WHEN** przedszkole ogłasza „od poniedziałku angielski co wtorek o 10:00”
- **THEN** angielski nie pojawia się w dniach kalendarza ani na ekranie głównym, a jest w liście „Stałe zajęcia w przedszkolu”

### Requirement: Zapisy i ankiety
Zajęcia, na które trzeba zapisywać dziecko osobno, SHALL zostawać wydarzeniami. Prośba o zapisy SHALL być sprawą „wymaga odpowiedzi” oznaczoną jako zapisy, a gdy odpowiedź jest przez ankietę lub formularz – jako ankieta. PWA SHALL pokazywać ten tag.

#### Scenario: Filcowanie z zapisami przez ankietę
- **WHEN** przedszkole pisze „zapisy na filcowanie 20.10 w ankiecie”
- **THEN** filcowanie jest w kalendarzu, a w „Wymaga odpowiedzi” jest sprawa z tagiem „Ankieta”

### Requirement: Dzisiaj i jutro
Ekran główny SHALL mieć sekcje „Dzisiaj” i „Jutro”, a w każdej informację o dniu wolnym, gdzie zawieźć dziecko, wydarzenia tego dnia i co przynieść. Dzień bez niczego SHALL być opisany jako zwykły dzień. Rzeczy i wydarzenia z dalszych dni SHALL zostać w dotychczasowych sekcjach.

#### Scenario: Jutro wycieczka
- **WHEN** jutro jest wycieczka z przyprowadzeniem do Bazy od 8:30 i trzeba przynieść przebranie
- **THEN** sekcja „Jutro” pokazuje Bazę z godzinami, wycieczkę i przebranie

### Requirement: Tagi miejsc
PWA SHALL wyróżniać ikoną i kolorem główne miejsca przyprowadzenia: Baza, Witosa, Pęgów, OOK, Kino, Dworzec. Inne miejsca SHALL mieć ogólną ikonę i swoją nazwę.

#### Scenario: Dwa miejsca
- **WHEN** wycieczka ma przyprowadzenie na Witosa 6 do 9:00 albo na dworzec do 9:20
- **THEN** kalendarz pokazuje tag Witosa i tag Dworzec z godzinami
