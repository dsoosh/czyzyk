# Design

## Decisions

### D1. Zamknięty zestaw rodzajów, etykiety od modelu
Rodzaje (`bring`, `payment`, `event`, `answer`, `done`, `not_applicable`) są stałe i wykonywane przez kod; model wybiera pasujące i nadaje krótkie etykiety oraz dane potrzebne do przeniesienia (opis, dzień, kwota). Dzięki temu model nie może zaproponować akcji, której system nie umie wykonać, a etykiety pasują do kontekstu („Tak, zapisujemy”).

### D2. Wykonanie w bazie
`apply_action_suggestion(id, index)` (każdy z rodziny) bierze propozycję zapisaną przy sprawie – klient wskazuje tylko numer. Przeniesienie tworzy element z grupą, dziećmi, wiadomościami źródłowymi i pewnością sprawy (`rationale`: „Z „Wymaga odpowiedzi”: …”), a sprawę zamyka z `resolution` = etykieta. Wszystko w jednej transakcji z blokadą wiersza.

### D3. Propozycje nie giną przy aktualizacji
Pole `suggestions` jest opcjonalne bez wartości domyślnej: aktualizacja sprawy bez nowych propozycji zostawia zapisane (domyślna pusta lista wyczyściłaby je przy każdej zmianie terminu).

### D4. Stare sprawy
Bez propozycji (`[]`) – tylko dotychczasowe odhaczanie; „Analizuj ponownie” przy wiadomości źródłowej dopisze propozycje.

## Risks / Trade-offs

- Model może zaproponować nietrafioną akcję – zawsze pozostaje zwykłe odhaczenie i cofnięcie; utworzony element można odhaczyć osobno.
