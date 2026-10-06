# Design

## Context

Dziś `extraction-scan` co minutę wybiera grupy, w których `max(received_at)` jest starsze niż `EXTRACTION_DEBOUNCE_MINUTES` (30), i wysyła `extract-group` (kolejka `stately`, `singletonKey = group_id`). Wiadomości wstawia API (`/ingest/notification`, `/import/chat`), worker nie wie o nich od razu.

## Decisions

### D1. Trigger z `pg_notify` zamiast wywołania kolejki z API
Trigger `after insert … for each row when (new.processed_at is null and new.status = 'active')` obejmuje wszystkie drogi zapisu bez zmian w API i bez zależności API od pg-boss. Powiadomienie wychodzi przy commit; Postgres scala identyczne powiadomienia w jednej transakcji, więc import tysięcy wiadomości daje jedno powiadomienie na grupę. Ładunek to tylko `group_id` (niezmiennik: bez treści).
- *Alternatywa:* `boss.send` w API – druga kopia logiki kolejki i nowa zależność API.

### D2. Krótkie opóźnienie zamiast okna ciszy
Worker wysyła `extract-group` ze `startAfter = EXTRACTION_DELAY_SECONDS` (domyślnie 15). Polityka `stately` dopuszcza jedno zadanie oczekujące na grupę, więc kolejne wiadomości w tym czasie nie tworzą nowych zadań – seria trafia do modelu razem. Wiadomość, która przyjdzie w trakcie ekstrakcji, tworzy nowe zadanie oczekujące i zostaje przetworzona zaraz po bieżącym (bieżące oznacza jako przetworzone tylko wiadomości, które wczytało).

### D3. Skan jako zabezpieczenie
Powiadomienia giną, gdy worker nie słucha (restart, zerwane połączenie). Skan co minutę zostaje, z progiem `EXTRACTION_DELAY_SECONDS`, więc najgorszy przypadek to ok. minuty opóźnienia.

### D4. Odnawianie nasłuchu
Osobny `pg.Client` (nie z puli) z `LISTEN`; przy błędzie lub zamknięciu połączenia ponowna próba po 5 s, aż do zatrzymania workera. Błędy logowane bez treści.

## Risks / Trade-offs

- Więcej wywołań modelu niż przy 30-minutowym oknie → opóźnienie konfigurowalne; przy większym ruchu można je wydłużyć bez zmian w kodzie.
- Wiadomość poprawiająca poprzednią („bal jednak w sobotę”) może przyjść już po ekstrakcji → ekstrakcja z kontekstem i operacją `update` obsługuje to tak jak dziś przy kolejnych seriach.
