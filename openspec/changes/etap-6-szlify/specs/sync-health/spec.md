# Spec Delta

## Purpose

Sprawia, że stan przepływu danych z jedynego telefonu-źródła jest widoczny: admin wie o awariach, a rodzina wie, kiedy informacje mogą być nieaktualne.

## ADDED Requirements

### Requirement: Status synchronizacji w panelu admina
Panel admina SHALL pokazywać czas ostatniego powiadomienia i ostatniego eksportu dla każdej śledzonej grupy, ostatni kontakt każdego urządzenia oraz dziennik synchronizacji z ostatnich 30 dni (rodzaj, status, krok błędu, wersja WhatsAppa) bez treści wiadomości.

#### Scenario: Przegląd stanu
- **WHEN** admin otwiera ekran „Synchronizacja”
- **THEN** widzi „Motylki: ostatnie powiadomienie 2 h temu, ostatni eksport 1 dzień temu” oraz listę ostatnich błędów

### Requirement: Baner nieaktualnych danych
Gdy od ostatnich danych z telefonu (powiadomienie lub eksport) minęło ponad 24 godziny, wszyscy członkowie rodziny SHALL widzieć na każdym ekranie baner „Informacje mogą być nieaktualne – ostatnia synchronizacja X godzin temu”.

#### Scenario: Wyjazd właściciela
- **WHEN** telefon nie wysłał danych od 30 godzin
- **THEN** każdy członek rodziny widzi baner z „30 godzin temu”

#### Scenario: Synchronizacja wznowiona
- **WHEN** po przerwie telefon wysyła nową wiadomość
- **THEN** baner znika przy następnym odświeżeniu

### Requirement: Alerty dla admina
System SHALL wysyłać adminowi powiadomienie push, gdy eksport na klik zakończy się błędem kroku lub urządzenie nie kontaktowało się z serwerem dłużej niż 12 godzin; ten sam problem MUST NOT generować alertu częściej niż raz na 24 godziny.

#### Scenario: Milczące urządzenie
- **WHEN** telefon nie kontaktował się z serwerem od 13 godzin
- **THEN** admin dostaje push „Telefon Darka milczy od 13 h – sprawdź czytnik powiadomień i baterię”

#### Scenario: Członek rodziny
- **WHEN** zachodzi warunek alertu
- **THEN** użytkownicy z rolą `family` nie dostają alertu administracyjnego (widzą tylko baner po 24 h)
