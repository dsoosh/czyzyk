## ADDED Requirements

### Requirement: Wywołanie zna swoje wiadomości
Każdy wpis dziennika wywołań modelu SHALL zawierać identyfikatory wiadomości, których dotyczył: nowe wiadomości partii dla wstępnej oceny i analizy, wiadomość ze zdjęciem dla kontroli zdjęcia. Dziennik SHALL pokazywać pojedyncze wywołanie, otwarte, pod adresem z jego identyfikatorem.

#### Scenario: Link z czatu
- **WHEN** admin otwiera link do wywołania z rozwiniętej wiadomości
- **THEN** widzi tylko to wywołanie, z zapytaniem i odpowiedzią modelu
