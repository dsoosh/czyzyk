## ADDED Requirements

### Requirement: Opis przedszkola
System SHALL przechowywać jeden opis tekstowy placówki (miejsca, prowadzący, grupy, kanały), widoczny dla członków rodziny i edytowany wyłącznie przez admina w PWA (Admin → Przedszkole). Opis MUST mieć najwyżej 8000 znaków.

#### Scenario: Admin zmienia opis
- **WHEN** admin dopisuje w opisie nową grupę i zapisuje
- **THEN** kolejna ekstrakcja i kolejne pytanie do asystenta uwzględniają nową treść

#### Scenario: Członek rodziny bez uprawnień admina
- **WHEN** członek rodziny bez roli admina wywołuje zapis opisu
- **THEN** baza odrzuca żądanie

### Requirement: Opis jako kontekst analizy i asystenta
Ekstrakcja SHALL otrzymywać opis przedszkola jako kontekst od rodziny, oddzielony od wiadomości z grup, i używać go do rozpoznawania miejsc, osób i grup. Asystent „Zapytaj” SHALL otrzymywać opis w danych każdego widoku.

#### Scenario: Wydarzenie „w Bazie”
- **WHEN** nauczycielka pisze „Jutro piknik w Bazie o 10”
- **THEN** model zna z opisu, że Baza to siedziba w Golędzinowie, i może wpisać ją jako miejsce wydarzenia

#### Scenario: Pytanie o przedszkole
- **WHEN** członek rodziny pyta asystenta „kto prowadzi fundację?”
- **THEN** odpowiedź opiera się na opisie przedszkola
