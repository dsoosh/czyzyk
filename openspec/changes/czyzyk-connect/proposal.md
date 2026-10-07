# Proposal

## Why

Aplikacja Android i PWA zainstalowana z przeglądarki nazywają się tak samo („Czyżyk”) i obie mają ikonę na ekranie telefonu – myli się je, a instalacja APK z wydania zgłasza konflikt z już zainstalowanym „Czyżykiem”. Użytkownik poprosił o zmianę nazwy aplikacji Android, np. na „Czyżyk Connect”.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** wydanie instaluje się jako osobna aplikacja „Czyżyk Connect” obok PWA, a kolejne wersje aktualizują ją same.

## What Changes

- Nazwa aplikacji Android: „Czyżyk Connect” (ikona, ekran ustawień telefonu, menu Udostępnij, okno aktualizacji).
- Identyfikator pakietu `pl.czyzyk.connect` zamiast `pl.czyzyk.app` – nowa instalacja nie koliduje ze starą wersją (debug ani wydaniem 1.7); starą trzeba odinstalować ręcznie.
- Plik w wydaniach GitHub: `czyzyk-connect.apk` (stały link `releases/latest/download/czyzyk-connect.apk`); aplikacja pobiera aktualizacje pod tą nazwą.
- PWA (Admin → Urządzenia) i dokumentacja używają nowej nazwy.

**Poza zakresem:** zmiana nazwy PWA.

## Capabilities

### New Capabilities

- `android-app-identity`: nazwa i identyfikator aplikacji Android odróżniające ją od PWA.

### Modified Capabilities

(brak – nazwa pliku w `android-app-updates` poprawiona w niezarchiwizowanej zmianie `aktualizacje-android`)

## Impact

- `apps/android` (Gradle `applicationId`, `app_name`, teksty, `ReleaseSource.APK_NAME`), `.github/workflows/android-release.yml`, `apps/pwa` (DevicesPage), dokumentacja.
- Jednorazowo: odinstalować starą aplikację, zainstalować `czyzyk-connect.apk`, nadać dostęp do powiadomień i sparować telefon.
- Stare wydanie 1.7 nie znajdzie pliku pod nową nazwą – jego automatyczna aktualizacja po cichu nie zadziała (i tak nie mogłaby: inny pakiet).
