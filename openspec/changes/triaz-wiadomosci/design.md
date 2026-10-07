# Design

## Decisions

### D1. Najpierw reguły, potem tani model
Reguły nic nie kosztują i są deterministyczne (testy), ale łapią tylko oczywistą pogawędkę. Tani model z krótkim promptem (bez promptu systemowego analizy, z 5 zamiast 50 wcześniejszych wiadomości) łapie resztę rozmów. Paczka jest pomijana tylko w całości: jeśli cokolwiek może być sprawą, idzie cała (kontekst).

### D2. Wątpliwość = analiza
Triaż ma tylko oszczędzać. Błąd modelu, brak wywołania narzędzia, brak `TRIAGE_MODEL` → pełna analiza. Wiadomości od rodziny przechodzą zawsze, bo mogą odpowiadać na sprawy („zapłacone”, „zgoda wysłana”).

### D3. Pominięte wiadomości zostają w kontekście
Pominięte wiadomości są oznaczone jako przetworzone, więc kolejne analizy widzą je jako kontekst; „Analizuj ponownie” działa na nie jak zwykle.
