# Spec Delta

## Purpose

Pozwala rodzicowi w każdej chwili sprawdzić, na podstawie jakich wiadomości aplikacja wie o danym elemencie, i ocenić to samodzielnie.

## ADDED Requirements

### Requirement: Link „skąd to wiem”
Każdy element wyciągnięty z wiadomości SHALL mieć w PWA link „skąd to wiem”, który otwiera jego wiadomości źródłowe.

#### Scenario: Otwarcie źródła
- **WHEN** użytkownik stuka „skąd to wiem” przy rzeczy „przebranie”
- **THEN** widzi wiadomość „W piątek bal, przebrania” z autorem, grupą i czasem wysłania

### Requirement: Wiadomość w kontekście rozmowy
Widok źródła SHALL pokazywać wiadomości źródłowe wyróżnione na tle kilku wiadomości poprzedzających i następujących w tej samej grupie, z możliwością doczytania dalszych.

#### Scenario: Kontekst rozmowy
- **WHEN** użytkownik otwiera źródło elementu
- **THEN** widzi do 10 wiadomości przed i po wiadomości źródłowej, a wiadomość źródłowa jest wyróżniona

### Requirement: Uzasadnienie i pewność
Widok źródła SHALL pokazywać uzasadnienie zapisane przy ekstrakcji i poziom pewności w formie słownej (wysoka / średnia / niska).

#### Scenario: Podgląd uzasadnienia
- **WHEN** użytkownik otwiera źródło elementu o pewności 0,92
- **THEN** widzi uzasadnienie i etykietę „pewność: wysoka”
