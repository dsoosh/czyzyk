# Spec Delta

## Purpose

Pozwala zapisać stałe zajęcia w określone dni tygodnia jako jedno wydarzenie i pokazuje każde ich wystąpienie.

## ADDED Requirements

### Requirement: Stałe zajęcia jako wydarzenie cykliczne
Analiza SHALL zapisywać stałe zajęcia w określone dni tygodnia jako jedno wydarzenie z dniami powtarzania i opcjonalną datą końca, a nie osobne wydarzenia na każdy tydzień. Zmiana dnia, godziny lub zakończenie zajęć MUST aktualizować to wydarzenie. Wydarzenie cykliczne SHALL pozostawać w kontekście analizy, dopóki się powtarza.

#### Scenario: Basen we wtorki
- **WHEN** wiadomość brzmi „Od przyszłego tygodnia basen w każdy wtorek o 9:00 do końca stycznia”
- **THEN** powstaje jedno wydarzenie „Basen” powtarzane we wtorki do 31 stycznia

### Requirement: Wystąpienia wszędzie, gdzie są wydarzenia
Ekran „Dziś”, kalendarz, poranny i wieczorny skrót, subskrypcja kalendarza i asystent SHALL pokazywać każde wystąpienie wydarzenia cyklicznego w jego dni tygodnia, o tej samej godzinie lokalnej i tej samej długości, do daty końca. Wystąpienie w dzień wolny całego przedszkola lub grupy wydarzenia MUST być pominięte. Przy wydarzeniu cyklicznym SHALL być widoczny opis powtarzania (np. „co wt, pt”).

#### Scenario: Dzień wolny
- **WHEN** w czwartek przedszkole jest nieczynne, a basen jest we wtorki i czwartki
- **THEN** w kalendarzu i w porannym skrócie czwartkowego basenu nie ma

#### Scenario: Zmiana czasu
- **WHEN** basen jest o 9:00, a w nocy z 24 na 25 października zmienia się czas
- **THEN** wtorkowy basen 27 października nadal jest o 9:00
