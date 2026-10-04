# Spec Delta

## Purpose

Określa, kto może założyć konto i zalogować się do prywatnej aplikacji rodzinnej oraz jak administrator zarządza listą osób z dostępem.

## ADDED Requirements

### Requirement: Logowanie przez Google
System SHALL umożliwiać logowanie wyłącznie przez konto Google (OAuth). Inne metody logowania (hasło, magic link, inni dostawcy) MUST być niedostępne.

#### Scenario: Członek rodziny loguje się przez Google
- **WHEN** osoba, której e-mail jest na liście dozwolonych, wybiera „Zaloguj przez Google” i kończy autoryzację w Google
- **THEN** zostaje zalogowana i widzi ekran główny aplikacji

#### Scenario: Próba logowania inną metodą
- **WHEN** ktoś próbuje założyć konto lub zalogować się e-mailem i hasłem albo magic linkiem
- **THEN** system odrzuca żądanie, a konto nie powstaje

### Requirement: Lista dozwolonych e-maili blokuje zakładanie kont
System SHALL odrzucać utworzenie konta dla adresu e-mail spoza listy dozwolonych, zanim konto zostanie zapisane. Porównanie adresów MUST być niewrażliwe na wielkość liter.

#### Scenario: Obca osoba próbuje się zalogować
- **WHEN** osoba z kontem Google, którego e-mail nie jest na liście dozwolonych, kończy autoryzację w Google
- **THEN** konto nie zostaje utworzone, a PWA pokazuje komunikat „Brak dostępu – ten adres nie jest na liście rodziny”

#### Scenario: E-mail różni się wielkością liter
- **WHEN** na liście jest `Anna@Example.com`, a Google zwraca `anna@example.com`
- **THEN** konto zostaje utworzone

### Requirement: Profil i rola członka rodziny
System SHALL przy utworzeniu konta zakładać profil z e-mailem, nazwą wyświetlaną z Google i rolą (`admin` albo `family`) przepisaną z listy dozwolonych.

#### Scenario: Profil admina
- **WHEN** loguje się po raz pierwszy osoba wpisana na listę z rolą `admin`
- **THEN** powstaje jej profil z rolą `admin`, a w PWA widzi zakładkę „Admin”

#### Scenario: Profil członka rodziny
- **WHEN** loguje się po raz pierwszy osoba wpisana z rolą `family`
- **THEN** powstaje jej profil z rolą `family`, a zakładka „Admin” jest niewidoczna

### Requirement: Usunięcie z listy odbiera dostęp
System SHALL odebrać dostęp do danych osobie usuniętej z listy dozwolonych, także jeśli ma aktywną sesję.

#### Scenario: Usunięty członek rodziny z aktywną sesją
- **WHEN** admin usuwa e-mail z listy dozwolonych, a ta osoba jest zalogowana
- **THEN** jej kolejne zapytania o dane zwracają pusty wynik lub błąd uprawnień, a PWA pokazuje ekran „Brak dostępu”

### Requirement: Zarządzanie listą dozwolonych e-maili
System SHALL pozwalać adminowi dodawać i usuwać adresy z listy dozwolonych oraz zmieniać ich rolę. Admin MUST NOT móc usunąć ani zdegradować samego siebie, aby nie zostawić aplikacji bez admina.

#### Scenario: Admin dodaje członka rodziny
- **WHEN** admin w panelu dodaje adres `babcia@example.com` z rolą `family`
- **THEN** adres pojawia się na liście, a ta osoba może się zalogować

#### Scenario: Admin próbuje usunąć siebie
- **WHEN** admin próbuje usunąć z listy własny adres
- **THEN** system odrzuca operację z komunikatem błędu, a lista się nie zmienia

#### Scenario: Członek rodziny próbuje zmienić listę
- **WHEN** użytkownik z rolą `family` wywołuje operację dodania adresu
- **THEN** system odrzuca operację z błędem uprawnień
