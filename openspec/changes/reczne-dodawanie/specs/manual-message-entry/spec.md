## ADDED Requirements

### Requirement: Wklejanie wiadomości skopiowanych z WhatsAppa
System SHALL pozwalać adminowi wkleić w PWA wiadomości skopiowane z WhatsAppa do wybranej śledzonej grupy. Gdy tekst ma nagłówki kopiowania WhatsAppa, autor i czas każdej wiadomości MUST pochodzić z nagłówków; w przeciwnym razie cały tekst SHALL być jedną wiadomością z autorem i czasem podanymi przez admina (domyślnie „Nieznany nadawca” i chwila wklejenia). Wklejone wiadomości MUST mieć źródło `manual`, MUST trafić do analizy bez czekania i MUST NOT tworzyć duplikatów wiadomości znanych z powiadomień lub eksportu.

#### Scenario: Pojedyncza wiadomość
- **WHEN** admin wkleja „Jutro zbiórka o 8:00”, podaje autora „Pani Ania” i godzinę
- **THEN** wiadomość z tym autorem i czasem pojawia się w historii grupy, a wynik analizy w ciągu kilku minut

#### Scenario: Kilka skopiowanych wiadomości
- **WHEN** admin wkleja tekst z nagłówkami „[18:02, 7.10.2026] Pani Ania: …”
- **THEN** każda wiadomość dostaje autora i czas z nagłówka, a wiadomość, która już przyszła z powiadomienia, jest pominięta

### Requirement: Wklejanie tylko przez admina, bez treści w logach
Wklejanie wiadomości MUST być dostępne tylko dla admina i tylko do śledzonej grupy, z limitem 200 wiadomości naraz. Dziennik synchronizacji i logi serwera MUST zawierać tylko liczby, bez treści i autorów wiadomości.

#### Scenario: Członek rodziny
- **WHEN** członek rodziny wysyła wklejone wiadomości do API
- **THEN** API odpowiada 403 i nic nie zapisuje

#### Scenario: Dziennik
- **WHEN** admin wkleja wiadomość
- **THEN** wpis w dzienniku synchronizacji zawiera liczbę dodanych i pominiętych wiadomości, bez ich treści
