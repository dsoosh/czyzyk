# Spec Delta

## Purpose

Pozwala adminowi wgrać z panelu PWA eksport czatu WhatsApp śledzonej grupy, aby uzupełnić wiadomości, których nie dostarczyły powiadomienia – wyłącznie jako tekst, bez zdjęć.

## ADDED Requirements

### Requirement: Wgrywanie eksportu w panelu admina
Admin SHALL móc w PWA wybrać plik eksportu czatu (`.txt` albo `.zip` z WhatsAppa) i śledzoną grupę, zobaczyć podgląd (liczba wiadomości, zakres dat) i zatwierdzić import. Grupa MUST być podpowiadana na podstawie nazwy pliku, gdy pasuje do nazwy śledzonej grupy.

#### Scenario: Import eksportu grupy
- **WHEN** admin wybiera plik „WhatsApp Chat with Motylki 2026/27.zip” i grupę „Motylki”
- **THEN** widzi podgląd z liczbą wiadomości i zakresem dat, a po zatwierdzeniu podsumowanie: nowe wiadomości, duplikaty, wiadomości do ekstrakcji

#### Scenario: Członek rodziny
- **WHEN** użytkownik z rolą `family` lub osoba spoza rodziny wywołuje import
- **THEN** operacja jest odrzucona z błędem uprawnień i nic nie jest zapisane

### Requirement: Tylko tekst opuszcza urządzenie
Z paczki ZIP PWA SHALL odczytać i wysłać wyłącznie plik tekstowy czatu. Zdjęcia, filmy, notatki głosowe i inne pliki z paczki MUST NOT być odczytywane ani wysyłane.

#### Scenario: Paczka ze zdjęciami
- **WHEN** ZIP zawiera `_chat.txt` i zdjęcia `IMG-…jpg`
- **THEN** na serwer trafia tylko treść `_chat.txt`, a wiadomości ze zdjęciami mają tylko flagę załącznika

#### Scenario: Paczka bez pliku czatu
- **WHEN** ZIP nie zawiera pliku tekstowego czatu
- **THEN** PWA pokazuje błąd „W paczce nie ma pliku czatu” i nic nie wysyła

### Requirement: Parsowanie eksportu
System SHALL parsować plik czatu w formatach polskich i angielskich (Android i iOS, zegar 24- i 12-godzinny), łączyć wiadomości wieloliniowe, pomijać komunikaty systemowe i wiadomości usunięte oraz rozpoznawać znaczniki załączników (wiadomość dostaje flagę załącznika, a znacznik nie trafia do treści). Czas MUST być interpretowany w strefie Europe/Warsaw.

#### Scenario: Wiadomość wieloliniowa
- **WHEN** wiadomość ma trzy linie, z których tylko pierwsza zaczyna się datą
- **THEN** powstaje jedna wiadomość z treścią trzech linii

#### Scenario: Format angielski 12-godzinny
- **WHEN** linia ma postać `10/9/26, 8:15 PM - Anna: See you`
- **THEN** wiadomość ma czas 9 października 2026, 20:15 czasu Europe/Warsaw

#### Scenario: Komunikat systemowy
- **WHEN** linia to „Wiadomości i połączenia są szyfrowane…” albo „Anna dodała Piotra”
- **THEN** nie powstaje wiadomość

### Requirement: Bez duplikatów
Wiadomość z eksportu o tym samym kluczu dopasowania co wiadomość już zapisana (z powiadomienia albo z wcześniejszego importu) SHALL zostać pominięta jako duplikat. Ponowny import tego samego pliku MUST NOT tworzyć nowych wiadomości.

#### Scenario: Wiadomość znana z powiadomienia
- **WHEN** eksport zawiera wiadomość zapisaną wcześniej z powiadomienia
- **THEN** w bazie jest jedna taka wiadomość, a podsumowanie liczy ją jako duplikat

### Requirement: Okres ekstrakcji
Admin SHALL wybrać, z ilu ostatnich dni nowe wiadomości trafiają do ekstrakcji (domyślnie 30). Starsze nowe wiadomości MUST zostać zapisane jako już przetworzone (historia i kontekst), bez wysyłania do modelu.

#### Scenario: Historia z całego roku
- **WHEN** eksport obejmuje rok, a okres ekstrakcji to 30 dni
- **THEN** do ekstrakcji trafiają tylko nowe wiadomości z ostatnich 30 dni, starsze są zapisane jako przetworzone

### Requirement: Dziennik bez treści
Import SHALL zapisywać w dzienniku synchronizacji rodzaj `export`, grupę i liczby (wiadomości, nowe, duplikaty, do ekstrakcji); dziennik i logi MUST NOT zawierać treści ani autorów wiadomości.

#### Scenario: Wpis w dzienniku
- **WHEN** import kończy się powodzeniem
- **THEN** `sync_log` ma wpis `export` z liczbami i bez treści wiadomości
