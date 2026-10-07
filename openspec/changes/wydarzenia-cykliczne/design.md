# Design

## Decisions

### D1. Jedno wydarzenie z regułą zamiast kopii na każdy tydzień
`starts_at`/`ends_at` opisują pierwsze wystąpienie (godzina i długość), `repeat_weekdays`/`repeat_until` – powtarzanie. Zmiana godziny to jedna aktualizacja, historia zmian (item-history) działa bez zmian. Wystąpienia są wyliczane przy odczycie.

### D2. Ta sama reguła w bazie i w PWA
Serwer (skróty, iCal, asystent) używa funkcji SQL `event_occurrences` (security invoker, więc RLS obowiązuje). PWA czyta wydarzenia przez PostgREST i rozwija je tą samą regułą w `lib/recurrence.ts`, mając już dni wolne z tego samego zapytania; testy obu stron sprawdzają te same przypadki (zmiana czasu, dni wolne grupy i całego przedszkola, data końca).

### D3. Dni wolne pomijają wystąpienia
Wystąpienie w dzień wolny całego przedszkola albo grupy wydarzenia nie jest pokazywane; dzień wolny innej grupy nie ma wpływu.

### D4. iCal bez RRULE
Subskrypcja kalendarza dostaje osobny wpis na każde wystąpienie (UID z datą) na rok do przodu – bez EXDATE dla dni wolnych, z którymi kalendarze różnie sobie radzą.
