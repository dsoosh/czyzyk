# Proposal

## Why

Aplikację Android instaluje się ręcznie z artefaktu CI, a każda nowa wersja wymaga ponownego pobrania i zainstalowania APK. Wersje debug z CI są podpisywane za każdym razem innym kluczem, więc nie da się ich nawet zaktualizować bez odinstalowania (i ponownego parowania). Użytkownik poprosił o sprawdzanie wersji na GitHubie i automatyczną aktualizację.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** merge zmian w `apps/android` do `main` publikuje podpisane wydanie na GitHubie, a zainstalowana aplikacja sama je wykrywa, pobiera, weryfikuje i instaluje (w tle, gdy Android na to pozwala, w przeciwnym razie po jednym potwierdzeniu).

## What Changes

- CI: nowy workflow `Android release` – po zmianach w `apps/android` na `main` buduje APK release podpisany stałym kluczem z sekretów GitHuba, z rosnącym `versionCode`, i publikuje wydanie GitHub z `czyzyk.apk` i `version.json` (wersja, tag, SHA-256, rozmiar). Bez sekretów workflow tylko ostrzega.
- CI (`ci.yml`): budowanie wariantu release (R8) przy każdym PR.
- Android: sprawdzanie `version.json` z najnowszego wydania przy otwarciu aplikacji (co najwyżej co 6 h) i raz dziennie w tle; pobranie APK z wydania o tym tagu, weryfikacja rozmiaru i SHA-256, instalacja przez `PackageInstaller` (bez pytania na Androidzie 12+, gdy aplikacja sama zainstalowała poprzednią wersję; inaczej okno „Zainstaluj”).
- Ekran telefonu: karta „Aktualizacje” (wersja, stan, „Sprawdź teraz”, „Zainstaluj”, zgoda na instalowanie).

**Poza zakresem:** sklep Google Play, kanały beta, aktualizacje wersji debug.

## Capabilities

### New Capabilities

- `android-app-updates`: publikowanie wydań aplikacji Android i ich automatyczna instalacja na telefonie.

### Modified Capabilities

(brak)

## Impact

- `.github/workflows/android-release.yml`, `.github/workflows/ci.yml`; `apps/android` (Gradle: podpis i wersja z env, `BuildConfig`; pakiet `update`; manifest: `REQUEST_INSTALL_PACKAGES`, odbiornik wyniku instalacji); dokumentacja (`apps/android/README.md`, `docs/wdrozenie.md`).
- Jednorazowo: wersję debug trzeba odinstalować i zainstalować wydanie z GitHuba (inny klucz podpisu), potem sparować telefon ponownie.
- Sekrety GitHuba (repozytorium publiczne – klucz nigdy w repo): `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
