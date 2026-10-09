## Purpose

Adresaci spraw zapisanych przed analizą dwuetapową liczeni z treści ich wiadomości.

## ADDED Requirements

### Requirement: Adresaci starych spraw z treści wiadomości
Sprawa zapisana przed analizą dwuetapową z przypisanymi dziećmi SHALL mieć za adresatów dzieci z grup sprawy wymienione w jej wiadomościach źródłowych, także w odmienionej formie imienia. Gdy wiadomości nie wymieniają żadnego dziecka, sprawa SHALL być sprawą całej grupy. Adresaci SHALL być przeliczani po dodaniu, zmianie i usunięciu dziecka.

#### Scenario: Sprawa jednego dziecka
- **WHEN** stara sprawa pochodzi z wiadomości „Zosia zapomniała dziś kapci”
- **THEN** widzi ją tylko rodzina Zosi

#### Scenario: Ogłoszenie dla grupy
- **WHEN** stara sprawa pochodzi z wiadomości „Jutro wycieczka do Zoo”
- **THEN** widzi ją każda rodzina z dzieckiem w grupie

#### Scenario: Dziecko dodane później
- **WHEN** stara wiadomość mówi „Lence trzeba odebrać plecak”, a rodzina dodaje dziecko Lena w tej grupie
- **THEN** sprawa jest tylko dla rodziny Leny
