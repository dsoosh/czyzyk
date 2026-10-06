## MODIFIED Requirements

### Requirement: Admin zarządza śledzeniem i nazwami
System SHALL pozwalać adminowi włączyć lub wyłączyć śledzenie grupy i nadać jej nazwę wyświetlaną. Aplikacja Android MUST pobrać aktualną listę śledzonych grup najpóźniej po upływie interwału synchronizacji wybranego na telefonie (domyślnie 15 minut).

#### Scenario: Admin włącza śledzenie
- **WHEN** admin oznacza grupę „Motylki 2026/27” jako śledzoną z nazwą „Motylki”, a telefon ma domyślny interwał
- **THEN** w ciągu 15 minut kolejne wiadomości z tej grupy trafiają na serwer, a PWA pokazuje je pod nazwą „Motylki”

#### Scenario: Admin wyłącza śledzenie
- **WHEN** admin wyłącza śledzenie grupy
- **THEN** po upływie interwału wybranego na telefonie telefon przestaje wysyłać jej wiadomości, a dotychczasowe dane pozostają w bazie

## ADDED Requirements

### Requirement: Konfigurowalny interwał synchronizacji
Aplikacja Android SHALL pozwalać wybrać interwał odświeżania listy śledzonych grup spośród wartości 15 min, 30 min, 1 godz., 3 godz. i 6 godz., domyślnie 15 min. Wybór MUST być zapisany na telefonie i obowiązywać po ponownym uruchomieniu. Interwał MUST NOT być krótszy niż 15 minut. Aplikacja SHALL umożliwiać natychmiastowe ręczne odświeżenie listy.

#### Scenario: Zmiana interwału
- **WHEN** właściciel telefonu wybiera „co 3 godz.”
- **THEN** okresowe odświeżanie listy grup odbywa się co 3 godziny, także po restarcie telefonu

#### Scenario: Ręczne odświeżenie
- **WHEN** przy interwale 6 godz. admin włącza śledzenie grupy, a właściciel stuka „Odśwież teraz”
- **THEN** telefon od razu pobiera listę grup i kolejne wiadomości z tej grupy trafiają na serwer

#### Scenario: Wysyłka bez zmian
- **WHEN** właściciel wybiera „co 6 godz.”, a przychodzi wiadomość ze śledzonej grupy
- **THEN** wiadomość jest wysyłana od razu, jak przy domyślnym interwale
