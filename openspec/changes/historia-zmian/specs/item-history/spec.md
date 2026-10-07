# Spec Delta

## Purpose

Pozwala rodzinie zobaczyć, jak sprawa zmieniała się w czasie i na podstawie których wiadomości.

## ADDED Requirements

### Requirement: Zapis historii zmian z analizy
Każde utworzenie, zmiana i odwołanie sprawy przez analizę wiadomości SHALL zapisać wpis historii z wiadomościami źródłowymi i uzasadnieniem. Wpis zmiany MUST zawierać poprzednią i nową wartość każdego zmienionego pola. Aktualizacja, która nie zmienia żadnej wartości, MUST NOT tworzyć wpisu. Historia SHALL być czytelna dla rodziny i zapisywana wyłącznie przez serwer.

#### Scenario: Zmiana godziny
- **WHEN** wiadomość „Zbiórka przesunięta na 10:30” zmienia wydarzenie zaplanowane na 9:00
- **THEN** historia ma wpis „Początek: 9:00 → 10:30” z tą wiadomością

### Requirement: Historia w „Skąd to wiem”
Widok „Skąd to wiem” SHALL pokazywać historię zmian od najnowszej (co się zmieniło, uzasadnienie, cytat wiadomości) i rozmowę wokół najnowszej wiadomości źródłowej. Dla sprawy bez historii z więcej niż jedną wiadomością źródłową widok SHALL pokazać wszystkie wiadomości źródłowe.

#### Scenario: Zaktualizowane wydarzenie
- **WHEN** użytkownik otwiera „Skąd to wiem” przy wydarzeniu, któremu zmieniono godzinę
- **THEN** widzi wpis „Zmieniono” z poprzednią i nową godziną oraz wiadomość o zmianie, a pod nim wpis „Utworzono” z pierwszą wiadomością
