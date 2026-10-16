# Proposal

## Why

Ogłoszenie wycieczki na lotnisko w Szymanowie podawało godziny dnia: przyprowadzenie do Bazy ok. 8:20–8:30, wyjazd o 9:00, powrót ok. 13–14. Analiza zapisała przyprowadzenie, początek i koniec wydarzenia, ale nie zapisała planu dnia (schedule), więc na stronie wydarzenia nie było timeline'u. W tej samej analizie cykl filcowania z listą pięciu dat w roku zapisał się jako zajęcia co piątek do czerwca.

Zmiana na prośbę użytkownika. **Gotowe, gdy:**
- wydarzenie z godzinami przyprowadzenia, początku albo końca ma timeline także bez zapisanego planu dnia;
- analiza wypełnia plan dnia, gdy wiadomość podaje co najmniej dwie godziny dnia wydarzenia;
- lista konkretnych dat daje osobne wydarzenia, a nie powtarzanie co tydzień.

## What Changes

- **PWA:** strona wydarzenia pokazuje plan dnia zapisany przez analizę. Gdy go nie ma, buduje timeline z przyprowadzenia, początku i końca wydarzenia. Potrzebne są co najmniej dwa punkty; wydarzenie całodniowe bez przyprowadzenia nie ma timeline'u.
- **Prompt:** reguła 20 i stała część promptu (działa także przy szablonie zapisanym przez admina). Plan dnia trzeba wypełnić przy co najmniej dwóch godzinach dnia, z przykładem „wyjazd o 9:00, powrót ok. 13/14”. Lista konkretnych dat oznacza osobne wydarzenia bez `repeat` (reguła 16).

## Capabilities

### Modified Capabilities

- `event-plan`: timeline z godzin wydarzenia i pełniejszy plan dnia.
