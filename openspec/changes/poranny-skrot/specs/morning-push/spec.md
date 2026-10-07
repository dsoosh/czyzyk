# Spec Delta

## Purpose

Przypomina rano, co dziś spakować i co się dzieje, oraz o zbliżających się terminach płatności i odpowiedzi.

## ADDED Requirements

### Requirement: Poranny skrót
O wybranej porannej godzinie (domyślnie 6:45, Europe/Warsaw) członek rodziny z włączonymi powiadomieniami SHALL dostać najwyżej raz dziennie powiadomienie „Dziś: …” z dniem wolnym, wydarzeniami z godziną i rzeczami do spakowania na dziś. Rzeczy spakowane i sprawy czekające na przegląd MUST być pominięte; pusty dzień MUST NOT wysyłać powiadomienia.

#### Scenario: Basen i kapcie
- **WHEN** dziś jest basen o 9:00, a do spakowania strój kąpielowy i kapcie
- **THEN** o 6:45 przychodzi „Dziś: Basen 09:00, spakować: kapcie, strój kąpielowy”

### Requirement: Przypomnienia o terminach
O porannej godzinie członek rodziny SHALL dostać najwyżej raz dziennie osobne powiadomienie z otwartymi płatnościami i sprawami „wymaga odpowiedzi”, których termin przypada dziś lub jutro. Zapłacone i rozwiązane sprawy MUST być pominięte. Przypomnienia SHALL dać się wyłączyć niezależnie od porannego skrótu.

#### Scenario: Składka i zgoda
- **WHEN** składka 20 zł ma termin dziś, a zgoda na wycieczkę jutro
- **THEN** rano przychodzi „Termin dziś: składka (20 zł). Termin jutro: Zgoda na wycieczkę”

#### Scenario: Zapłacone
- **WHEN** składka została oznaczona jako zapłacona
- **THEN** nie ma jej w przypomnieniach
