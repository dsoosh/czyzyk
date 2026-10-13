## Purpose

Gdzie i do której przyprowadzić dziecko w dniu wydarzenia oraz plan godzinowy wydarzenia.

## ADDED Requirements

### Requirement: Przyprowadzenie dziecka
Analiza SHALL zapisywać przy wydarzeniu miejsca, w których można przyprowadzić dziecko, z godziną „od” i „do”, gdy wiadomość je podaje; może być kilka miejsc. Aktualizacja wydarzenia bez tych informacji MUST NOT ich usuwać. PWA SHALL pokazywać je w podglądzie wydarzenia (z linkiem do mapy), w kalendarzu i na ekranie „Dziś”, a skróty push SHALL je podawać.

#### Scenario: Wcześniejsze przyprowadzenie do Bazy
- **WHEN** nauczycielka pisze „od 8:30 w Bazie dzieci mają czas na śniadanie, na busa najpóźniej 8:45, 9:00 wyjazd spod Bazy”
- **THEN** wydarzenie ma przyprowadzenie „Baza od 8:30 do 8:45”

#### Scenario: Dwa miejsca zbiórki
- **WHEN** wiadomość mówi „zbiórka do 9:00 na Witosa 6 albo 9:20 przy bibliotece na dworcu”
- **THEN** kalendarz pokazuje „przyprowadzenie: Witosa 6 do 9:00 albo biblioteka na dworcu do 9:20”

### Requirement: Plan dnia jako timeline
Analiza SHALL zapisywać plan godzinowy wydarzenia (godzina, opcjonalny koniec, krótki opis), gdy wiadomość go podaje. Podgląd wydarzenia SHALL pokazywać plan jako poziomy timeline w kolejności godzin, przewijany w bok na wąskim ekranie.

#### Scenario: Wycieczka do muzeum
- **WHEN** wiadomość podaje „9:00 wyjazd, 10:30-12:00 lekcja edukacyjna, 12:30 wyjazd do Bazy”
- **THEN** podgląd wydarzenia pokazuje timeline: 9:00 wyjazd, 10:30–12:00 lekcja edukacyjna, 12:30 wyjazd do Bazy
