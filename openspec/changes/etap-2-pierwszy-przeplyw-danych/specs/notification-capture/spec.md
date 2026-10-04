# Spec Delta

## Purpose

Przechwytuje wiadomości ze śledzonych grup WhatsApp na telefonie właściciela na podstawie powiadomień systemowych i niezawodnie dostarcza je na serwer, bez ingerencji w protokół WhatsApp.

## ADDED Requirements

### Requirement: Odczyt wiadomości z powiadomień WhatsApp
Aplikacja Android SHALL odczytywać powiadomienia aplikacji WhatsApp i WhatsApp Business i wyciągać z nich nazwę grupy, autora, treść i czas wysłania każdej wiadomości. Aplikacja MUST NOT korzystać z API ani protokołu WhatsApp i MUST NOT wysyłać niczego do WhatsApp.

#### Scenario: Pojedyncza wiadomość w grupie
- **WHEN** w śledzonej grupie „Motylki” Pani Ania pisze „W piątek bal, przebrania”
- **THEN** aplikacja wysyła na serwer wiadomość z grupą „Motylki”, autorem „Pani Ania”, tą treścią i czasem wysłania

#### Scenario: Powiadomienie z kilkoma wiadomościami
- **WHEN** jedno powiadomienie zawiera trzy nowe wiadomości z tej samej grupy
- **THEN** każda z nich jest wysyłana jako osobna wiadomość, a ponowne wyświetlenie tych samych wiadomości w kolejnym powiadomieniu nie tworzy duplikatów

### Requirement: Pomijanie podsumowań
Aplikacja Android SHALL pomijać zbiorcze powiadomienia-podsumowania (np. „5 nowych wiadomości z 2 czatów”), które nie zawierają treści konkretnych wiadomości.

#### Scenario: Podsumowanie zbiorcze
- **WHEN** WhatsApp wyświetla powiadomienie „5 nowych wiadomości”
- **THEN** nic nie jest wysyłane na serwer

### Requirement: Oznaczanie załączników
Aplikacja Android SHALL oznaczać wiadomości będące placeholderem załącznika (zdjęcie, film, dokument) flagą załącznika i zwiększać lokalny licznik zaległych załączników.

#### Scenario: Zdjęcie w grupie
- **WHEN** w śledzonej grupie pojawia się powiadomienie „📷 Zdjęcie”
- **THEN** wiadomość trafia na serwer z flagą załącznika, a licznik zaległych załączników w aplikacji rośnie o 1

### Requirement: Dostarczenie mimo braku sieci
Aplikacja Android SHALL zapisywać każdą przechwyconą wiadomość w lokalnej kolejce przed wysłaniem i ponawiać wysyłkę z rosnącym odstępem aż do potwierdzenia przez serwer. Każda wiadomość MUST mieć klucz idempotencji nadany na telefonie, niezmienny między ponowieniami.

#### Scenario: Telefon offline
- **WHEN** wiadomość przychodzi, gdy telefon nie ma internetu
- **THEN** zostaje w kolejce i trafia na serwer po odzyskaniu połączenia, także po restarcie telefonu

#### Scenario: Ponowienie po zerwanym połączeniu
- **WHEN** serwer zapisał wiadomość, ale odpowiedź do telefonu nie dotarła i telefon wysyła ją ponownie
- **THEN** na serwerze istnieje dokładnie jedna kopia tej wiadomości

### Requirement: Ekran ustawień i diagnostyki
Aplikacja Android SHALL pokazywać stan wymaganych uprawnień (dostęp do powiadomień, wyłączona optymalizacja baterii), stan sparowania, liczbę wiadomości w kolejce i czas ostatniej udanej wysyłki, z przyciskami prowadzącymi do odpowiednich ustawień systemu oraz instrukcją ustawienia grup na cichy dźwięk zamiast wyciszenia.

#### Scenario: Brak dostępu do powiadomień
- **WHEN** właściciel otwiera aplikację, a dostęp do powiadomień jest wyłączony
- **THEN** widzi czerwony status „Brak dostępu do powiadomień” i przycisk otwierający ekran systemowy tego uprawnienia
