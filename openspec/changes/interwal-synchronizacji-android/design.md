# Design

## Context

`Work.schedulePeriodicSync` planuje `SyncWorker` co 15 minut (`ExistingPeriodicWorkPolicy.KEEP`), a `CaptureService` przy każdym powiadomieniu wywołuje synchronizację, jeśli lista grup jest starsza niż TTL z `GET /ingest/config` (900 s). Wysyłka wiadomości nie zależy od tego interwału.

## Decisions

### D1. Stała lista wartości zamiast pola liczbowego
Do wyboru 15, 30, 60, 180 i 360 minut (`SyncInterval`), domyślnie 15. Lista nie pozwala wpisać wartości poniżej minimum WorkManagera (15 min) ani absurdalnie długiej. Nieznana zapisana wartość (np. po zmianie listy) wraca do domyślnej.

### D2. Ustawienie lokalne
Interwał jest preferencją telefonu-źródła, więc trzymamy go w `SharedPreferences` (`AppState`), nie w bazie. Nie jest sekretem.

### D3. Przeplanowanie przez `UPDATE`
Po zmianie interwału `enqueueUniquePeriodicWork("sync-periodic", UPDATE, …)` zmienia okres istniejącego zadania bez jego anulowania. Wywołania przy starcie czytnika i po parowaniu też używają `UPDATE` z bieżącym interwałem, więc zadanie zawsze ma okres zgodny z ustawieniem.

### D4. Świeżość listy = max(TTL serwera, interwał)
Sprawdzanie przy powiadomieniu używa dłuższej z wartości: przy interwale 6 godz. telefon nie odpytuje serwera przy każdym powiadomieniu, a przy 15 min zachowanie jest jak dotąd (TTL 900 s).

### D5. Ręczne odświeżenie
Przycisk „Odśwież teraz” kolejkuje jednorazowy `SyncWorker`; karta pokazuje czas ostatniego udanego pobrania listy, żeby było widać skutek.

## Risks / Trade-offs

- Dłuższy interwał opóźnia skutek włączenia lub wyłączenia śledzenia grupy przez admina → opis przy wyborze mówi o tym wprost; „Odśwież teraz” pozwala wymusić pobranie.
- Android może opóźniać zadania okresowe (Doze) niezależnie od ustawienia → bez zmian względem stanu obecnego.
