# Czyżyk – aplikacja Android

Źródło danych dla asystenta przedszkolnego: czytnik powiadomień WhatsApp (etap 2) i eksport na klik z kontrolą obrazów na telefonie (etap 4). Instalowana ręcznie z pliku APK, poza Sklepem Play.

Na etapie 1 to pusty szkielet: Kotlin, Jetpack Compose, minSdk 26, jedna aktywność „Czyżyk”.

## Budowanie

Wymaga JDK 17 i Android SDK (platforma 36). Najprościej otworzyć katalog `apps/android` w Android Studio albo:

```bash
cd apps/android
echo "sdk.dir=$HOME/Android/Sdk" > local.properties   # ścieżka do Android SDK
./gradlew :app:testDebugUnitTest :app:assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

> Środowisko chmurowe Claude Code nie ma Android SDK ani dostępu do repozytorium Google Maven
> (`dl.google.com`), więc APK budujemy lokalnie. Wersje AGP, Kotlina i Compose w
> `gradle/libs.versions.toml` mogą wymagać podbicia do najnowszych przy pierwszym otwarciu w Android Studio.
