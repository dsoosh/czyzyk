# Design

## Decisions

### D1. Zamknięty zestaw rodzajów, etykiety od modelu
Rodzaje (`bring`, `payment`, `event`, `answer`, `done`, `not_applicable`) są stałe i wykonywane przez kod; model wybiera pasujące i nadaje krótkie etykiety oraz dane potrzebne do przeniesienia (opis, dzień, kwota). Dzięki temu model nie może zaproponować akcji, której system nie umie wykonać, a etykiety pasują do kontekstu („Tak, zapisujemy”).

### D2. Wykonanie w bazie
`apply_action_suggestion(id, index)` (każdy z rodziny) bierze propozycję zapisaną przy sprawie – klient wskazuje tylko numer. Przeniesienie tworzy element z grupą, dziećmi, wiadomościami źródłowymi i pewnością sprawy (`rationale`: „Z „Wymaga odpowiedzi”: …”), a sprawę zamyka z `resolution` = etykieta. Wszystko w jednej transakcji z blokadą wiersza.

### D2a. Termin rzeczy przeniesionej ze sprawy
Akcję wybiera się „teraz”, więc rzecz do przyniesienia z minionym lub pustym terminem dostaje najbliższy dzień roboczy (Europe/Warsaw) – inaczej trafiałaby w przeszłość i nie było jej na ekranie „Dziś”. Wynik RPC podaje datę, a PWA pokazuje ją w potwierdzeniu („Dodano do rzeczy do przyniesienia na jutro.”).

### D3. Propozycje nie giną przy aktualizacji
Pole `suggestions` jest opcjonalne bez wartości domyślnej: aktualizacja sprawy bez nowych propozycji zostawia zapisane (domyślna pusta lista wyczyściłaby je przy każdej zmianie terminu).

### D4. Stare sprawy
Bez propozycji (`[]`) – do czasu uzupełnienia tylko dotychczasowe odhaczanie. Model widzi propozycje istniejących spraw w kontekście (także pustą listę) i przy najbliższej analizie grupy – np. po „Analizuj ponownie” – uzupełnia je operacją update z samym polem `suggestions`. Taka operacja zapisuje tylko propozycje: nie zmienia statusu, pewności ani źródeł i nie trafia do kolejki przeglądu, nawet przy sprawie zatwierdzonej przez admina.

## Risks / Trade-offs

- Model może zaproponować nietrafioną akcję – zawsze pozostaje zwykłe odhaczenie i cofnięcie; utworzony element można odhaczyć osobno.
