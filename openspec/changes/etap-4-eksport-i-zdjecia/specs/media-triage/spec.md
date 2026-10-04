# Spec Delta

## Purpose

Rozpoznaje, czym jest każde zdjęcie z grupy przedszkolnej, wyciąga informacje z dokumentów (plany, jadłospisy, plakaty) i porządkuje zdjęcia z zajęć w albumy.

## ADDED Requirements

### Requirement: Klasyfikacja obrazu
Każdy nowy obraz SHALL być klasyfikowany jednym wywołaniem modelu z wizją (obraz + tekst sąsiednich wiadomości) jako `document`, `class_photo` albo `other`, z podpisem po polsku. Wynik MUST przejść walidację schematu.

#### Scenario: Zdjęcie planu miesiąca
- **WHEN** w grupie pojawia się zdjęcie tabeli „Plan na październik”
- **THEN** obraz ma kategorię `document` i podpis „Plan zajęć na październik”

### Requirement: Ekstrakcja z dokumentów
Dla obrazów `document` system SHALL wyciągać elementy w tym samym formacie i z tymi samymi zasadami (pewność, przegląd, walidacja) co ekstrakcja tekstu; elementy MUST wskazywać wiadomość z obrazem jako źródło, a obraz MUST być widoczny w widoku źródła.

#### Scenario: Kryterium etapu – plan miesiąca
- **WHEN** zdjęcie planu miesiąca zawiera „15.10 – teatrzyk, 22.10 – dzień kropki”
- **THEN** w kalendarzu pojawiają się wydarzenia 15.10 „Teatrzyk” i 22.10 „Dzień kropki”, a ich źródłem jest to zdjęcie

### Requirement: Albumy zdjęć z zajęć
Zdjęcia `class_photo` jednego autora w jednej grupie wysłane w odstępach nie większych niż 10 minut SHALL tworzyć jeden album z tytułem i podpisem wyprowadzonym z otaczającego tekstu oraz datą pierwszego zdjęcia.

#### Scenario: Kryterium etapu – seria zdjęć
- **WHEN** Pani Ania wysyła 6 zdjęć w ciągu 4 minut i pisze „Dziś lepiliśmy jeżyki z kasztanów”
- **THEN** powstaje jeden album „Jeżyki z kasztanów” z 6 zdjęciami i podpisem z tej wiadomości

### Requirement: Obrazy pozostałe
Obrazy `other` SHALL NOT być pokazywane w galerii ani przekazywane do ekstrakcji.

#### Scenario: Mem w grupie
- **WHEN** ktoś wysyła obrazek z życzeniami
- **THEN** obraz ma kategorię `other` i nie pojawia się w galerii

### Requirement: Deduplikacja zdjęć
System SHALL rozpoznawać to samo zdjęcie wysłane ponownie (także po kompresji lub zmianie nazwy) po hashu percepcyjnym i nie tworzyć drugiej kopii w albumach.

#### Scenario: Zdjęcie przesłane drugi raz
- **WHEN** to samo zdjęcie pojawia się w drugim eksporcie pod inną nazwą
- **THEN** w galerii istnieje jedna kopia

### Requirement: Wersje do wyświetlania
Dla każdego obrazu system SHALL zapisywać oryginał oraz miniaturę i wersję do wyświetlania w formacie WebP.

#### Scenario: Zapis zdjęcia
- **WHEN** obraz zostaje zapisany
- **THEN** w magazynie istnieją oryginał, miniatura i wersja WebP
