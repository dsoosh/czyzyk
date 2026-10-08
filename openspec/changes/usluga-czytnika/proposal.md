# Proposal

## Why

Strażnik czytnika (`straznik-czytnika`) podłącza czytnik powiadomień z powrotem dopiero po fakcie: przy synchronizacji, otwarciu aplikacji, restarcie albo aktualizacji. Między tymi chwilami Android może zamknąć proces w tle i odłączyć czytnik, a wiadomości z tego czasu przepadają. Użytkownik chce usługi, która stale pilnuje, żeby system nie odłączał Czyżyka od powiadomień.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** Czyżyk Connect działa jako usługa pierwszoplanowa z cichym powiadomieniem i co kilka minut sprawdza czytnik.

## What Changes

- `ReaderService`: usługa pierwszoplanowa typu `specialUse` z cichym, stałym powiadomieniem „Czyżyk czyta powiadomienia” (kanał o najniższej ważności). Android praktycznie nie zamyka procesu z taką usługą. Co 5 minut wywołuje `ListenerWatchdog.ensureBound`.
- Usługa startuje, gdy jest włączona i jest dostęp do powiadomień:
  - po podłączeniu czytnika;
  - przy otwarciu aplikacji;
  - przy synchronizacji;
  - po restarcie telefonu i po aktualizacji.
  Odmowa systemu przy starcie w tle jest ignorowana, a start ponawiany przy kolejnej okazji.
- Ekran telefonu: przełącznik „Stała ochrona czytnika”, domyślnie włączony.
- Manifest: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`, deklaracja usługi z opisem użycia.

**Poza zakresem:** prośba o uprawnienie do powiadomień (Android 13+). Bez niego powiadomienie usługi jest ukryte, ale usługa działa.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `notification-capture`: stała usługa chroniąca czytnik powiadomień.

## Impact

- Android: `ReaderService` (nowy), ikona `ic_stat_reader`, `AppState.readerServiceEnabled`, `MainActivity`, `CaptureService`, `SyncWorker`, `RestartReceiver`, manifest, test `ReaderServiceTest`, `MIN_TESTS`.
- Bateria: usługa nie wykonuje pracy poza sprawdzeniem co 5 minut.
