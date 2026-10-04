# Spec Delta

## Purpose

Pokazuje rodzinie wszystkie wydarzenia i dni wolne przedszkola w czasie, w widoku listy i miesiąca.

## ADDED Requirements

### Requirement: Widok listy
Kalendarz SHALL mieć widok listy aktywnych wydarzeń i dni wolnych od dziś w przód, pogrupowanych po dniach, z możliwością przewinięcia do przeszłości.

#### Scenario: Lista od dziś
- **WHEN** użytkownik otwiera kalendarz w widoku listy
- **THEN** widzi dzisiejszy dzień na górze i kolejne dni z wydarzeniami, z godzinami lub oznaczeniem „cały dzień”

### Requirement: Widok miesiąca
Kalendarz SHALL mieć widok miesiąca z oznaczeniem dni z wydarzeniami i dniami wolnymi; wybranie dnia pokazuje jego elementy.

#### Scenario: Wybór dnia
- **WHEN** użytkownik stuka w dzień z kropką w widoku miesiąca
- **THEN** pod siatką widzi wydarzenia i dni wolne tego dnia

#### Scenario: Zmiana miesiąca
- **WHEN** użytkownik przewija do następnego miesiąca
- **THEN** widzi wydarzenia tego miesiąca

### Requirement: Tylko aktywne elementy
Kalendarz SHALL pokazywać wyłącznie elementy o statusie `active`; odwołane i oczekujące na przegląd MUST być ukryte.

#### Scenario: Odwołane wydarzenie
- **WHEN** wydarzenie ma status `cancelled`
- **THEN** nie pojawia się w żadnym widoku kalendarza

### Requirement: Szczegóły wydarzenia
Wybranie wydarzenia SHALL pokazywać jego szczegóły: tytuł, termin, miejsce, grupę, powiązane rzeczy do przyniesienia i link do źródła.

#### Scenario: Szczegóły balu
- **WHEN** użytkownik otwiera wydarzenie „Bal”
- **THEN** widzi termin, grupę „Motylki”, rzecz „przebranie” i link „skąd to wiem”
