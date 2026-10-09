## Purpose

Asystent „Zapytaj” podpowiada, jak coś zrobić w aplikacji, i linkuje do właściwego miejsca.

## ADDED Requirements

### Requirement: Pomoc w obsłudze aplikacji
Asystent SHALL odpowiadać na pytania o obsługę aplikacji na podstawie opisu jej ekranów i sekcji, krótko i w krokach, z linkiem do miejsca, gdzie użytkownik to zrobi. Asystent MUST używać wyłącznie linków z opisu aplikacji. Opis stron admina MUST trafiać tylko do promptu administratora.

#### Scenario: Jak dodać drugiego rodzica
- **WHEN** członek rodziny pyta „jak dodać męża?”
- **THEN** asystent opisuje kroki i podaje link do „Ustawienia → Moja rodzina”

### Requirement: Klikalne linki w odpowiedzi
PWA SHALL pokazywać link z odpowiedzi asystenta jako link w aplikacji tylko wtedy, gdy prowadzi do znanego miejsca z opisu aplikacji. Inne linki MUST być pokazane jako zwykły tekst. Kliknięcie linku SHALL otwierać to miejsce (z przewinięciem do sekcji ustawień) i zamykać panel asystenta.

#### Scenario: Link do sekcji ustawień
- **WHEN** odpowiedź zawiera „[Ustawienia → Moja rodzina](/ustawienia#rodzina)”, a użytkownik w nią stuka
- **THEN** otwierają się ustawienia przewinięte do sekcji „Moja rodzina”, a panel asystenta się zamyka
