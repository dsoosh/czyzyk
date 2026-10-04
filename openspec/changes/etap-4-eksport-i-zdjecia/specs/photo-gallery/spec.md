# Spec Delta

## Purpose

Pozwala rodzinie przeglądać zdjęcia z zajęć przedszkolnych uporządkowane w albumy, bez szukania ich w historii czatu.

## ADDED Requirements

### Requirement: Lista albumów
PWA SHALL pokazywać albumy od najnowszego, z okładką, tytułem, datą, nazwą grupy i liczbą zdjęć.

#### Scenario: Otwarcie galerii
- **WHEN** użytkownik otwiera zakładkę „Galeria”
- **THEN** widzi albumy od najnowszego z miniaturami okładek

### Requirement: Przeglądanie albumu
Album SHALL pokazywać siatkę miniatur, podpis i podgląd pełnoekranowy z przesuwaniem między zdjęciami oraz linkiem do wiadomości źródłowej.

#### Scenario: Podgląd zdjęcia
- **WHEN** użytkownik stuka miniaturę
- **THEN** widzi zdjęcie w wersji do wyświetlania i może przesunąć do następnego

### Requirement: Dostęp do plików tylko przez podpisane URL-e
Pliki multimedialne SHALL być dostępne wyłącznie przez podpisane URL-e ważne najwyżej 1 godzinę, wydawane tylko członkom rodziny. Magazyn MUST NOT mieć publicznego dostępu.

#### Scenario: Wygasły link
- **WHEN** ktoś otwiera link do zdjęcia po upływie jego ważności
- **THEN** magazyn odmawia dostępu

#### Scenario: Osoba spoza rodziny prosi o link
- **WHEN** sesja bez profilu rodziny prosi o podpisany URL zdjęcia
- **THEN** żądanie jest odrzucone
