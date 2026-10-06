# Tasks

## 1. PWA

- [x] 1.1 Wykrycie aplikacji Android (`window.CzyzykAndroid`), przekierowanie logowania `czyzyk://auth/callback`, przycisk „Ustawienia telefonu”, parametr `app` w linku parowania; weryfikacja: testy komponentów i `pairingLink`

## 2. Android

- [ ] 2.1 `PairingLink` z opcjonalnym `app`, `AppState.appUrl`, walidacja adresu; weryfikacja: testy jednostkowe
- [ ] 2.2 WebView z PWA (przechwytywanie adresów spoza PWA, `czyzyk://auth/callback`, most JS, wybór plików, Wstecz, ekran błędu) i ekran „Ustawienia telefonu”; weryfikacja: testy jednostkowe reguł nawigacji i `./gradlew :app:testDebugUnitTest :app:assembleDebug` w CI

## 3. Dokumentacja

- [x] 3.1 `docs/wdrozenie.md` i `apps/android/README.md`: adres przekierowania w Supabase, ograniczenia WebView; weryfikacja: `npm run spec:validate`
