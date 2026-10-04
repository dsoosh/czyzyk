# Spec Delta

## Purpose

Zapewnia, że dane do systemu może wysyłać wyłącznie sparowany telefon właściciela i że jego dostęp da się w każdej chwili odebrać.

## ADDED Requirements

### Requirement: Wydanie tokenu urządzenia
System SHALL pozwalać adminowi wygenerować token dla nazwanego urządzenia. Token MUST być losowy (co najmniej 256 bitów), pokazany dokładnie raz w momencie utworzenia i przechowywany wyłącznie jako hash.

#### Scenario: Admin dodaje telefon
- **WHEN** admin w panelu dodaje urządzenie „Telefon Darka”
- **THEN** widzi token i kod QR do zeskanowania w aplikacji Android, a po zamknięciu okna token nie jest już nigdzie wyświetlany

#### Scenario: Członek rodziny próbuje wygenerować token
- **WHEN** użytkownik z rolą `family` wywołuje generowanie tokenu
- **THEN** system odrzuca operację z błędem uprawnień

### Requirement: Uwierzytelnianie endpointów ingestu
Endpointy `/ingest/*` SHALL przyjmować wyłącznie żądania z ważnym, nieunieważnionym tokenem urządzenia. Sesja użytkownika PWA ani klucz `anon` MUST NOT dawać do nich dostępu.

#### Scenario: Żądanie bez tokenu
- **WHEN** ktoś wysyła `POST /ingest/notification` bez nagłówka z tokenem
- **THEN** serwer odpowiada 401 i niczego nie zapisuje

#### Scenario: Token unieważniony
- **WHEN** admin unieważnia urządzenie, a telefon wysyła kolejną wiadomość jego tokenem
- **THEN** serwer odpowiada 401, a aplikacja Android pokazuje „Urządzenie odłączone – sparuj ponownie”

### Requirement: Monitoring ostatniego kontaktu
System SHALL zapisywać czas ostatniego udanego żądania każdego urządzenia i pokazywać go adminowi.

#### Scenario: Telefon wysłał wiadomość
- **WHEN** urządzenie wysyła poprawne żądanie ingestu
- **THEN** w panelu admina przy urządzeniu widać „ostatni kontakt: przed chwilą”

### Requirement: Bezpieczne przechowywanie tokenu na telefonie
Aplikacja Android SHALL przechowywać token wyłącznie w zaszyfrowanym magazynie systemowym i MUST NOT umieszczać go w logach.

#### Scenario: Sparowanie telefonu
- **WHEN** właściciel skanuje kod QR z panelu admina
- **THEN** aplikacja zapisuje adres serwera i token w zaszyfrowanym magazynie i pokazuje „Połączono z serwerem”

### Requirement: Limit zapytań ingestu
Serwer SHALL ograniczać liczbę żądań `/ingest/*` na token i na adres IP oraz odpowiadać 429 po przekroczeniu limitu.

#### Scenario: Zalew żądań
- **WHEN** jeden token wysyła więcej żądań na minutę niż skonfigurowany limit
- **THEN** nadmiarowe żądania dostają 429, a aplikacja Android ponawia je później
