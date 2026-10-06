# Czyżyk – aplikacja Android

Źródło danych dla asystenta przedszkolnego: czytnik powiadomień WhatsApp (etap 2) i eksport na klik z kontrolą obrazów na telefonie (etap 4). Instalowana ręcznie z pliku APK, poza Sklepem Play.

Kotlin, Jetpack Compose, minSdk 26.

## Co robi (etap 2)

- **Parowanie** – link `czyzyk://pair?server=…&token=…` z panelu admina PWA (kod QR, stuknięcie linku albo wklejenie). Adres serwera i token trzymane w `EncryptedSharedPreferences`; po odpowiedzi 401 aplikacja pokazuje „Urządzenie odłączone”.
- **Czytnik powiadomień** (`capture/CaptureService`) – `NotificationListenerService` dla WhatsApp i WhatsApp Business. Z `MessagingStyle` czyta grupę, autora, treść i czas; pomija czaty prywatne i podsumowania. Placeholdery załączników (📷 Zdjęcie, 📄 dokument…) dostają flagę i zwiększają licznik.
- **Tylko śledzone grupy** – lista pobierana z `GET /ingest/config` co wybrany interwał (karta **Synchronizacja**: 15 min – domyślnie, 30 min, 1, 3 lub 6 godz.; przycisk „Odśwież teraz”). Interwał nie wpływa na wysyłkę wiadomości, która jest natychmiastowa; dłuższy oznacza tylko, że telefon później zauważy włączenie lub wyłączenie grupy w panelu admina. Z innych grup na serwer trafia wyłącznie nazwa grupy (`POST /ingest/seen-groups`), żeby admin mógł ją włączyć.
- **Kolejka offline** (`queue/MessageQueue`, SQLite) + WorkManager (`work/SendWorker`) – wiadomość jest zapisywana przed wysyłką i usuwana dopiero po odpowiedzi serwera; ponowienia z wykładniczym backoffem. Klucz idempotencji to UUIDv5 z treści powiadomienia, więc ponownie wyświetlone powiadomienie nie tworzy duplikatu.
- **Ekran statusu** – parowanie, dostęp do powiadomień, optymalizacja baterii (przyciski do ustawień systemu), liczba wiadomości w kolejce, zaległe załączniki, ostatnia wysyłka, wskazówki („cichy dźwięk zamiast wyciszenia”).

## Aplikacja Czyżyk w telefonie (WebView)

Głównym widokiem jest PWA Czyżyka w osadzonym WebView, więc z aplikacji korzysta się tak jak w przeglądarce. Obecny ekran (parowanie, uprawnienia, kolejka, synchronizacja) to **Ustawienia telefonu** – otwiera się z PWA (Ustawienia → „Ustawienia telefonu”), z ekranu błędu ładowania albo sam, gdy aplikacja nie zna adresu PWA.

- **Adres PWA** przychodzi w linku parowania (`&app=…`, dopisuje go panel admina) albo wpisuje się go ręcznie na karcie „Aplikacja Czyżyk”.
- **Logowanie Google**: Google blokuje logowanie w WebView, więc otwiera się ono w przeglądarce telefonu i wraca do aplikacji przez `czyzyk://auth/callback?code=…`; aplikacja kończy logowanie w WebView. Wymaga wpisu `czyzyk://auth/callback` w Supabase (Authentication → URL Configuration → Redirect URLs).
- W WebView otwierają się tylko strony z adresu PWA; inne linki (np. z wiadomości) idą do przeglądarki. Most `window.CzyzykAndroid` ma tylko `openPhoneSettings()`.
- **Udostępnianie eksportu czatu**: w WhatsAppie grupa → ⋮ → Więcej → Eksportuj czat → wybierz **Czyżyk**. Aplikacja wyciąga z paczki tylko tekst czatu (zdjęcia i filmy zostają na telefonie) i otwiera Admin → Import z podglądem i podpowiedzianą grupą.
- Ograniczenie: Android WebView nie obsługuje powiadomień Web Push – powiadomienia działają w PWA zainstalowanej z przeglądarki.

Aplikacja nigdy nic nie wysyła do WhatsAppa i nie korzysta z jego protokołu.

## Budowanie

Wymaga JDK 17 i Android SDK (platforma 36). Najprościej otworzyć katalog `apps/android` w Android Studio albo:

```bash
cd apps/android
echo "sdk.dir=$HOME/Android/Sdk" > local.properties   # ścieżka do Android SDK
./gradlew :app:testDebugUnitTest :app:assembleDebug   # testy JVM/Robolectric + APK
# APK: app/build/outputs/apk/debug/app-debug.apk
```

CI (GitHub Actions) buduje APK przy każdym pushu – artefakt `czyzyk-debug-apk`.

> Środowisko chmurowe Claude Code nie ma Android SDK ani dostępu do repozytorium Google Maven
> (`dl.google.com`), więc APK budujemy lokalnie. Wersje AGP, Kotlina i Compose w
> `gradle/libs.versions.toml` mogą wymagać podbicia do najnowszych przy pierwszym otwarciu w Android Studio.
