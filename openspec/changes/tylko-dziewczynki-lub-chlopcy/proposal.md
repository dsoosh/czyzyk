# Proposal

## Why

Wiadomość „Dziewczynki potrzebują spódnicy, żeby ją przytrzymać, więc jest mile widziana” dała sprawę dla całej grupy. Rodzina chłopca (Wicka) dostała więc zadanie przyniesienia spódnicy. Prośby skierowane tylko do dziewczynek albo tylko do chłopców nie powinny trafiać do rodzin dzieci drugiej płci.

Zmiana na prośbę użytkownika. **Gotowe, gdy:**
- prośba tylko dla dziewczynek albo tylko dla chłopców trafia wyłącznie do rodzin dzieci tej płci;
- gdy wśród rodzin w grupie nie ma dziecka tej płci, element nie powstaje;
- rzecz „mile widziana” jest rzeczą do przyniesienia, a nie sprawą „wymaga odpowiedzi”.

## What Changes

- **Stała część promptu (Rodziny i dzieci):** prośbę tylko dla jednej płci model przypisuje w `children` dzieciom tej płci z bloku `<rodziny>`. Płeć rozpoznaje po imieniu. Gdy nie ma takiego dziecka, element nie powstaje. Rzecz mile widziana albo potrzebna to `bring_item`. Reguła jest w stałej części, więc działa też przy szablonie zapisanym przez admina.
- **Ewaluacja:** dwa przypadki w `cases.json` – dziewczynka i chłopiec w grupie (spódnica tylko dla dziewczynki) oraz sam chłopiec (brak elementu).

## Capabilities

### Modified Capabilities

- `item-extraction`: sprawy tylko dla dziewczynek albo chłopców.
