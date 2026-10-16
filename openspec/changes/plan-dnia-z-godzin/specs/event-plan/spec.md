# Spec Delta

## ADDED Requirements

### Requirement: Timeline z godzin wydarzenia
Strona wydarzenia SHALL pokazywać „Plan dnia” z zapisanego planu, a gdy go nie ma – zbudowany z godzin przyprowadzenia, początku i końca wydarzenia, jeśli są co najmniej dwa takie punkty. Wydarzenie bez co najmniej dwóch punktów MUST NOT mieć timeline'u.

#### Scenario: Wycieczka bez zapisanego planu
- **WHEN** wydarzenie ma przyprowadzenie do Bazy 8:20–8:30, początek 9:00 i koniec 14:00, a analiza nie zapisała planu dnia
- **THEN** strona wydarzenia pokazuje timeline: „przyprowadzenie: Baza 8:20–8:30”, „początek 9:00”, „koniec 14:00”

### Requirement: Plan dnia z godzin w wiadomości
Analiza SHALL wypełniać plan dnia wydarzenia, gdy wiadomość podaje co najmniej dwie godziny dnia wydarzenia, także gdy nie nazywa ich planem. Lista konkretnych dat MUST dawać osobne wydarzenia zamiast powtarzania co tydzień.

#### Scenario: Wyjazd i powrót
- **WHEN** wiadomość podaje „wyjazd autobusem spod Bazy o 9:00, powrót około 13/14:00”
- **THEN** wydarzenie ma plan dnia z punktami 9:00 „wyjazd autobusem spod Bazy” i 13:00–14:00 „powrót do Bazy”

#### Scenario: Terminy na cały rok
- **WHEN** wiadomość podaje terminy warsztatów 23.10, 18.12, 19.02, 23.04 i 11.06
- **THEN** powstaje pięć wydarzeń, żadne nie powtarza się co tydzień
