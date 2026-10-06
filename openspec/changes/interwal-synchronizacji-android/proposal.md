# Proposal

## Why

Telefon odświeża listę śledzonych grup na stałe co 15 minut. Właściciel telefonu chce sam zdecydować, jak często aplikacja ma to robić – rzadziej, żeby oszczędzać baterię i transfer, albo zostać przy 15 minutach, gdy admin często zmienia śledzone grupy.

Zmiana poza kolejnością etapów, na prośbę użytkownika (jak `import-eksportu-z-pwa`). **Gotowe, gdy:** na ekranie aplikacji Android można wybrać interwał odświeżania, wybór przetrwa restart telefonu, a okresowa synchronizacja i sprawdzanie świeżości listy grup stosują wybraną wartość.

## What Changes

- Android: karta **Synchronizacja** na ekranie statusu – wybór interwału: 15 min (domyślnie), 30 min, 1 godz., 3 godz., 6 godz., godzina ostatniego odświeżenia i przycisk „Odśwież teraz”.
- Wybrany interwał zapisany lokalnie (`SharedPreferences`), nie na serwerze.
- Okresowy `SyncWorker` przeplanowywany po zmianie interwału; lista grup uznawana za nieaktualną po dłuższym z: TTL z serwera, wybrany interwał.
- Wymaganie `group-tracking` „najpóźniej 15 minut” staje się „najpóźniej po wybranym interwale (domyślnie 15 minut)”.

**Poza zakresem:** interwały krótsze niż 15 minut (minimum WorkManagera dla zadań okresowych), wysyłka wiadomości (pozostaje natychmiastowa, z kolejką offline), ustawianie interwału z PWA.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `group-tracking`: czas, w jakim telefon pobiera zmienioną listę śledzonych grup, zależy od interwału wybranego na telefonie.

## Impact

- Android: `AppState` (nowe ustawienie, czas ostatniego odświeżenia), `Work.schedulePeriodicSync`, `MainActivity` (nowa karta), testy Robolectric.
- Serwer, baza, PWA: bez zmian (`config_ttl_seconds` nadal 900 s).
- Archiwizacja dopiero po `etap-2-pierwszy-przeplyw-danych`: zmiana modyfikuje wymaganie `group-tracking` z tego etapu.
