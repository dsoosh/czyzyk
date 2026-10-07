## ADDED Requirements

### Requirement: Ręczne dodanie grupy
System SHALL pozwalać adminowi dodać grupę po nazwie, zanim telefon zgłosi z niej pierwszą wiadomość. Dodana grupa MUST być od razu śledzona, a jej nazwa MUST być znormalizowana tą samą regułą co nazwy z powiadomień. Dodanie nazwy, która już istnieje, SHALL włączyć śledzenie istniejącej grupy zamiast tworzyć duplikat. Tylko admin MUST móc dodawać grupy.

#### Scenario: Nowa grupa przed pierwszą wiadomością
- **WHEN** admin dodaje grupę „Rada rodziców” w zakładce Grupy
- **THEN** grupa jest na liście jako śledzona, a telefon po odświeżeniu listy grup zapisuje wiadomości z niej

#### Scenario: Grupa już zgłoszona przez telefon
- **WHEN** admin dodaje nazwę grupy, którą telefon już zgłosił jako nieśledzoną
- **THEN** istniejąca grupa zostaje śledzona, bez drugiego wpisu i bez utraty nazwy wyświetlanej

#### Scenario: Członek rodziny
- **WHEN** członek rodziny próbuje dodać grupę
- **THEN** system odmawia
