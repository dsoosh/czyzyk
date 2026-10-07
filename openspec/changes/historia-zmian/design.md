# Design

## Decisions

### D1. Historia zapisywana przez worker, nie trigger
Trigger na tabelach spraw zapisywałby też odhaczanie „spakowane” i „zapłacone” oraz nie znałby wiadomości źródłowej ani uzasadnienia. Worker zapisuje wpis w transakcji analizy, z wiadomościami operacji.

### D2. Różnica pól w kształcie danych analizy
`changes` dla zmiany to `{pole: {from, to}}` w polach danych analizy (np. `start` jako lokalna data/godzina), więc PWA formatuje je tak samo jak model je widzi. Pole `event` (powiązanie rzeczy z wydarzeniem) i `suggestions` nie trafiają do historii.

### D3. Starsze sprawy
Sprawy sprzed zmiany nie mają historii; ich poprzednich wartości nie da się odtworzyć. „Skąd to wiem” pokazuje dla nich wszystkie wiadomości źródłowe (lista `source_message_ids` zawsze zbierała też aktualizacje).
