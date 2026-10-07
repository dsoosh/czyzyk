# Tasks

## 1. Wysyłka natychmiastowa

- [x] 1.1 `Outbox.drain` – wspólne opróżnianie kolejki (z blokadą) dla `SendWorker` i wysyłki natychmiastowej; weryfikacja: testy Robolectric `WorkersTest` (opróżnienie kolejki, zatrzymanie na błędzie sieci, brak parowania)
- [x] 1.2 `CaptureService` wysyła od razu w wątku pod `PARTIAL_WAKE_LOCK`, przy niepowodzeniu kolejkuje `SendWorker`; uprawnienie `WAKE_LOCK`; weryfikacja: `./gradlew :app:testDebugUnitTest :app:assembleDebug` w CI
- [ ] 1.3 Test na telefonie: wiadomość przy wygaszonym ekranie widoczna w PWA w ciągu minuty; weryfikacja: ręcznie przez użytkownika
