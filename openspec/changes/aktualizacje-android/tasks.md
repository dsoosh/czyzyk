# Tasks

## 1. Wydania w CI

- [x] 1.1 Gradle: podpis i wersja z env, `BuildConfig` (`UPDATE_REPO`, `UPDATES_ENABLED`); `ci.yml` buduje też release; weryfikacja: `assembleRelease` w CI
- [ ] 1.2 Workflow `android-release.yml` (sekrety → podpis, `versionCode`, `version.json`, wydanie GitHub); weryfikacja: przebieg na `main` po merge (bez sekretów – ostrzeżenie i zielony przebieg)

## 2. Aktualizacja na telefonie

- [x] 2.1 Sprawdzanie i pobieranie (`version.json`, walidacja, SHA-256, limit, sprzątanie); weryfikacja: testy jednostkowe z MockWebServer w CI
- [x] 2.2 Instalacja `PackageInstaller` + odbiornik wyniku, praca okresowa, okno i karta „Aktualizacje”; weryfikacja: testy planowania pracy w CI, kompilacja release w CI
- [x] 2.3 Dokumentacja (README Androida, wdrożenie: sekrety, klucz, przejście z debug); weryfikacja: przegląd
