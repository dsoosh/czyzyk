# Spec Delta

## ADDED Requirements

### Requirement: Ręczne odświeżenie mimo ponowień
„Odśwież teraz” w Czyżyk Connect SHALL od razu pobrać listę śledzonych grup i wysłać kolejkę wiadomości, także gdy wcześniejsze próby czekają na ponowienie po błędach serwera.

#### Scenario: Serwer wrócił po awarii
- **WHEN** po kilku godzinach błędów serwera API znów działa, a wysyłka czeka na kolejną próbę
- **THEN** stuknięcie „Odśwież teraz” wysyła kolejkę i odświeża listę grup bez czekania na zaplanowaną próbę

### Requirement: Ostatni błąd połączenia
Ekran statusu Czyżyk Connect SHALL pokazywać przyczynę i godzinę ostatniego nieudanego kontaktu z serwerem (wysyłki albo odświeżenia listy grup). Po udanej wysyłce albo udanym odświeżeniu błąd MUST zniknąć.

#### Scenario: Błąd serwera
- **WHEN** wysyłka kończy się odpowiedzią HTTP 500
- **THEN** ekran statusu pokazuje „Ostatni błąd: błąd serwera (HTTP 500)” z godziną

#### Scenario: Połączenie wróciło
- **WHEN** kolejna wysyłka się udaje
- **THEN** ekran statusu nie pokazuje już ostatniego błędu
