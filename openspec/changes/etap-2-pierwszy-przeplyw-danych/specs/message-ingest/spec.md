# Spec Delta

## Purpose

Przyjmuje wiadomości ze sparowanego telefonu, zapisuje je trwale bez duplikatów i przekazuje do przetwarzania.

## ADDED Requirements

### Requirement: Przyjęcie wiadomości z powiadomienia
Serwer SHALL przyjmować wiadomość (grupa, autor, treść, czas wysłania, flaga załącznika, klucz idempotencji), walidować ją i zapisywać jako aktywną wiadomość ze źródłem `notification` oznaczoną jako nieprzetworzona. Wiadomość z grupy nieśledzonej MUST zostać odrzucona.

#### Scenario: Poprawna wiadomość
- **WHEN** telefon wysyła poprawną wiadomość ze śledzonej grupy
- **THEN** serwer odpowiada 201 z identyfikatorem wiadomości, a w bazie powstaje wiadomość ze źródłem `notification`

#### Scenario: Wiadomość z nieśledzonej grupy
- **WHEN** telefon wysyła wiadomość z grupy, która nie jest śledzona
- **THEN** serwer odpowiada 422 i nie zapisuje treści

#### Scenario: Niepoprawne dane
- **WHEN** żądanie nie zawiera autora albo czas jest w niepoprawnym formacie
- **THEN** serwer odpowiada 400 z opisem błędnego pola i niczego nie zapisuje

### Requirement: Idempotencja i deduplikacja
Serwer SHALL traktować ponowne żądanie z tym samym kluczem idempotencji jako sukces bez tworzenia kopii. Wiadomości SHALL dodatkowo mieć klucz dopasowania: grupa + autor + czas zaokrąglony do minuty + hash znormalizowanej treści (małe litery, ujednolicone białe znaki i Unicode); druga wiadomość o tym samym kluczu dopasowania MUST NOT tworzyć nowego wiersza.

#### Scenario: Ten sam klucz idempotencji
- **WHEN** telefon wysyła drugi raz wiadomość z tym samym kluczem idempotencji
- **THEN** serwer odpowiada 200 z identyfikatorem istniejącej wiadomości

#### Scenario: Ta sama wiadomość z innego powiadomienia
- **WHEN** ta sama wiadomość dociera dwa razy z różnymi kluczami idempotencji, z różnicą białych znaków i w tej samej minucie
- **THEN** w bazie istnieje jedna wiadomość

### Requirement: Rejestracja ostatniej aktywności grupy
Serwer SHALL aktualizować czas ostatniego powiadomienia grupy przy każdej przyjętej wiadomości.

#### Scenario: Nowa wiadomość w grupie
- **WHEN** serwer zapisuje wiadomość z grupy „Motylki”
- **THEN** czas ostatniego powiadomienia tej grupy jest równy czasowi przyjęcia wiadomości

### Requirement: Logi bez treści wiadomości
Serwer SHALL NOT zapisywać w logach aplikacji treści wiadomości ani nazwisk autorów; logi zawierają tylko identyfikatory, kody statusu i czasy.

#### Scenario: Błąd zapisu
- **WHEN** zapis wiadomości kończy się błędem
- **THEN** log zawiera identyfikator żądania i kod błędu, ale nie treść ani autora
