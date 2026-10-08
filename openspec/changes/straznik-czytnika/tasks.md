# Tasks

## 1. Telefon

- [x] 1.1 `ListenerWatchdog` (requestRebind, przełączenie komponentu po okresie karencji), `onListenerDisconnected`, wywołania w `SyncWorker`, `MainActivity.onResume` i `RestartReceiver`; weryfikacja: `ListenerWatchdogTest`, `./gradlew :app:testDebugUnitTest :app:assembleDebug` w CI
- [x] 1.2 Linia stanu czytnika na ekranie telefonu; weryfikacja: build w CI
- [ ] 1.3 Na telefonie: po kilku dniach i aktualizacji powiadomienia nadal są zapisywane; weryfikacja: użytkownik
