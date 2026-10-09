# Spec Delta

## Purpose

Zapisuje i pokazuje, gdzie odbywa się wydarzenie i dokąd zawieźć dzieci.

## ADDED Requirements

### Requirement: Miejsce i zbiórka z analizy
Analiza SHALL zapisywać przy wydarzeniu dwa pola:
- `location`: gdzie wydarzenie się odbywa (cel);
- `meeting_point`: dokąd przywieźć lub skąd odebrać dzieci, gdy to nie przedszkole.

Pole niepodane albo wskazujące przedszkole MUST pozostać puste. Wiadomość, która podaje lub zmienia miejsce albo zbiórkę istniejącego wydarzenia, SHALL je aktualizować. Późniejsza zmiana innych pól MUST NOT czyścić zbiórki.

#### Scenario: Wycieczka ze zbiórką na dworcu
- **WHEN** wiadomość brzmi „W piątek wycieczka do ZOO, zbiórka na dworcu PKP o 7:30”
- **THEN** wydarzenie ma miejsce „ZOO” i zbiórkę „dworzec PKP”

### Requirement: Miejsce i zbiórka widoczne
Strona wydarzenia SHALL pokazywać miejsce i zbiórkę z linkiem do mapy. Ekran „Dziś” i kalendarz SHALL pokazywać je przy wydarzeniu. Poranny i wieczorny skrót SHALL je dopisywać do wydarzenia.

#### Scenario: Skrót
- **WHEN** jutro jest wycieczka o 8:00 do ZOO ze zbiórką na dworcu PKP
- **THEN** wieczorny skrót zawiera „Wycieczka 08:00 (ZOO; zbiórka: dworzec PKP)”
