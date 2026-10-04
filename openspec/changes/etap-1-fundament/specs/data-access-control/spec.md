# Spec Delta

## Purpose

Gwarantuje, że dane z grup przedszkolnych (wiadomości innych rodziców, zdjęcia dzieci) są dostępne wyłącznie dla rodziny, niezależnie od tego, czy klient korzysta z interfejsu PWA, czy wywołuje bazę bezpośrednio publicznym kluczem.

## ADDED Requirements

### Requirement: Odczyt danych tylko dla rodziny
Baza danych SHALL zwracać dane domenowe (wiadomości, wydarzenia, rzeczy do przyniesienia, płatności, sprawy, dni wolne, fakty, albumy, grupy) wyłącznie zalogowanym użytkownikom posiadającym profil rodziny. Reguła MUST być egzekwowana w bazie dla każdej tabeli.

#### Scenario: Zapytanie z publicznym kluczem bez logowania
- **WHEN** ktoś odpytuje dowolną tabelę domenową, używając tylko publicznego klucza `anon`, bez sesji
- **THEN** otrzymuje pusty wynik lub błąd uprawnień, nigdy wiersze danych

#### Scenario: Zalogowany użytkownik spoza rodziny
- **WHEN** zapytanie wykonuje zalogowana sesja, dla której nie istnieje profil rodziny
- **THEN** otrzymuje pusty wynik

#### Scenario: Członek rodziny czyta wydarzenia
- **WHEN** zalogowany członek rodziny odpytuje wydarzenia
- **THEN** otrzymuje wszystkie wydarzenia

### Requirement: Zapis tylko przez usługi serwerowe i wąskie operacje
Klienci SHALL NOT móc bezpośrednio wstawiać, zmieniać ani usuwać wierszy w tabelach. Zapis z klienta MUST odbywać się wyłącznie przez nazwane operacje (RPC), z których każda zmienia tylko określone pola i sprawdza uprawnienia wywołującego.

#### Scenario: Członek rodziny próbuje zmienić wydarzenie bezpośrednio
- **WHEN** członek rodziny wysyła bezpośredni UPDATE lub INSERT do tabeli wydarzeń
- **THEN** baza odrzuca zmianę, a dane pozostają niezmienione

#### Scenario: Usługa serwerowa zapisuje dane
- **WHEN** usługa serwerowa używająca klucza serwisowego zapisuje wiadomość
- **THEN** zapis się udaje

### Requirement: Dane administracyjne tylko dla admina
Lista dozwolonych e-maili, urządzenia i dziennik synchronizacji SHALL być widoczne i modyfikowalne wyłącznie dla użytkowników z rolą `admin`. Każda operacja administracyjna MUST sprawdzać rolę `admin` w bazie.

#### Scenario: Członek rodziny czyta listę urządzeń
- **WHEN** użytkownik z rolą `family` odpytuje listę urządzeń
- **THEN** otrzymuje pusty wynik

#### Scenario: Osoba spoza rodziny wywołuje operację administracyjną
- **WHEN** sesja bez profilu rodziny wywołuje operację dodania e-maila do listy
- **THEN** operacja jest odrzucona z błędem uprawnień

### Requirement: Dane prywatne użytkownika tylko dla właściciela
Wątki chatbota, subskrypcje push i tokeny iCal SHALL być widoczne wyłącznie dla użytkownika, do którego należą.

#### Scenario: Członek rodziny czyta cudzy wątek chatbota
- **WHEN** użytkownik A odpytuje wątki chatbota należące do użytkownika B
- **THEN** otrzymuje pusty wynik

### Requirement: Sekrety wyłącznie po stronie serwera
Klucz serwisowy bazy oraz klucze dostawców AI SHALL być dostępne wyłącznie usługom serwerowym. Kod i konfiguracja PWA MUST zawierać tylko publiczny URL projektu i publiczny klucz `anon`.

#### Scenario: Sprawdzenie zbudowanej PWA
- **WHEN** zbudowane pliki PWA są przeszukiwane pod kątem klucza serwisowego i kluczy dostawców AI
- **THEN** żaden z nich nie występuje

### Requirement: Dane w regionie UE
Baza danych i magazyn plików SHALL być utrzymywane w regionie Unii Europejskiej.

#### Scenario: Weryfikacja regionu projektu
- **WHEN** admin sprawdza konfigurację projektu bazy
- **THEN** region projektu jest regionem UE
