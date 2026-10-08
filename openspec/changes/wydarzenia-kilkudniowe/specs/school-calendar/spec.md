# Spec Delta

## Purpose

Pokazuje wydarzenia i dni wolne trwające kilka dni jako jeden wpis kalendarza.

## ADDED Requirements

### Requirement: Wpisy kilkudniowe jako jeden wpis
Lista kalendarza SHALL pokazywać dzień wolny od–do i wydarzenie trwające kilka dni jeden raz: pod pierwszym dniem albo pod pierwszym dniem widocznego zakresu, gdy zaczęły się wcześniej. Taki wpis MUST mieć zakres dat. Widok miesiąca SHALL oznaczać każdy dzień takiego wpisu. Osobne wpisy tej samej grupy na kolejne dni (z dopuszczalną przerwą na weekend) SHALL być scalane w jeden wpis:
- dni wolne o tym samym powodzie;
- jednorazowe całodniowe wydarzenia o tej samej nazwie (pomijając dopisek „dzień N”).

#### Scenario: Ferie
- **WHEN** przedszkole jest nieczynne od poniedziałku 16.02 do piątku 20.02
- **THEN** lista kalendarza pokazuje jeden wpis „Przedszkole nieczynne” z zakresem „pn 16.02 – pt 20.02”, a w widoku miesiąca oznaczone jest każde z pięciu dni

#### Scenario: Osobne wpisy na kolejne dni
- **WHEN** analiza zapisała „Zielona szkoła” osobno na 12, 13 i 14 maja
- **THEN** lista kalendarza pokazuje jedno wydarzenie „Zielona szkoła” z zakresem 12–14 maja

### Requirement: Analiza zapisuje okres jako jeden element
Analiza SHALL zapisywać wydarzenie trwające kilka dni jako jedno wydarzenie ze startem i końcem. Dla wydarzenia całodniowego koniec to ostatni dzień. Okres, w którym przedszkole lub grupa jest nieczynna, SHALL być jednym dniem wolnym od–do. Analiza MUST NOT tworzyć osobnych elementów na każdy dzień okresu.

#### Scenario: Zielona szkoła
- **WHEN** wiadomość brzmi „Zielona szkoła od 12 do 14 maja”
- **THEN** powstaje jedno całodniowe wydarzenie ze startem 12 maja i końcem 14 maja
