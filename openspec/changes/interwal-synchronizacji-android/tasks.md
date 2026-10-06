# Tasks

## 1. Ustawienie i harmonogram

- [ ] 1.1 `SyncInterval` (15/30/60/180/360 min, domyślnie 15), zapis w `AppState`, czas ostatniego pobrania listy, świeżość = max(TTL, interwał); weryfikacja: testy Robolectric `AppState` (domyślna wartość, zapis, nieznana wartość → domyślna, świeżość)
- [ ] 1.2 `Work.schedulePeriodicSync` z bieżącym interwałem i polityką `UPDATE`; weryfikacja: test Robolectric z `WorkManagerTestInitHelper` – okres zadania `sync-periodic` po zmianie interwału

## 2. Ekran

- [ ] 2.1 Karta „Synchronizacja” w `MainActivity`: wybór interwału, ostatnie odświeżenie, „Odśwież teraz”; weryfikacja: `./gradlew :app:testDebugUnitTest :app:assembleDebug` w CI

## 3. Dokumentacja

- [x] 3.1 `apps/android/README.md`: opis ustawienia; weryfikacja: `npm run spec:validate`
