# Design

## Decisions

### D1. Wydania GitHub jako źródło aktualizacji
Repozytorium jest publiczne, więc telefon nie potrzebuje tokenu. Stały adres `https://github.com/<repo>/releases/latest/download/version.json` zwraca opis najnowszego wydania: `{versionCode, versionName, tag, sha256, size}`. APK telefon pobiera z `https://github.com/<repo>/releases/download/<tag>/czyzyk-connect.apk` – adres składany z repozytorium wkompilowanego w aplikację (`BuildConfig.UPDATE_REPO`) i tagu `android-v<liczba>`, nigdy z dowolnego URL-a z pliku. Bez API GitHuba, więc bez limitów zapytań i bez parsowania dużych odpowiedzi.

### D2. Podpis i numer wersji w CI
Klucz podpisu (keystore) jest w sekretach GitHuba jako base64 i trafia na dysk runnera tylko na czas budowania. Gradle bierze podpis i wersję ze zmiennych środowiskowych (`CZYZYK_KEYSTORE_FILE`, `CZYZYK_KEYSTORE_PASSWORD`, `CZYZYK_KEY_ALIAS`, `CZYZYK_KEY_PASSWORD`, `CZYZYK_VERSION_CODE`, `CZYZYK_VERSION_NAME`); lokalnie i w PR-ach budują się bez nich. `versionCode = 1000 + 10 × numer przebiegu + próba` – rośnie z każdym wydaniem, a ponowne uruchomienie przebiegu nie koliduje z istniejącym tagiem. Bez sekretów workflow kończy się ostrzeżeniem, bez wydania.

### D3. Weryfikacja przed instalacją
Pobieranie strumieniowe do `filesDir/updates/` z limitem 100 MB; rozmiar i SHA-256 muszą zgadzać się z `version.json`, inaczej plik jest usuwany. Ostateczną gwarancją jest Android: aktualizacja instaluje się tylko z tym samym kluczem podpisu co zainstalowana aplikacja. Stare pliki są usuwane, gdy wersja jest już zainstalowana.

### D4. Instalacja przez `PackageInstaller`
Sesja `MODE_FULL_INSTALL` z `setRequireUserAction(USER_ACTION_NOT_REQUIRED)` (Android 12+). Android instaluje wtedy bez pytania, jeśli Czyżyk sam zainstalował bieżącą wersję i ma zgodę „Instalowanie nieznanych aplikacji”; pierwsza aktualizacja po instalacji z przeglądarki wymaga potwierdzenia. Wynik trafia do niewyeksportowanego odbiornika: przy `STATUS_PENDING_USER_ACTION` z ekranu (użytkownik kliknął „Zainstaluj”) od razu otwiera systemowe potwierdzenie; w tle tylko zostawia aktualizację jako gotową – aplikacja zaproponuje ją przy następnym otwarciu.

### D5. Kiedy sprawdzać
Okresowa praca WorkManagera raz na 24 h (sieć wymagana) sprawdza, pobiera i próbuje instalacji w tle. Przy otwarciu aplikacji sprawdzenie, jeśli ostatnie było ponad 6 h temu; gotowa aktualizacja pokazuje okno „Nowa wersja Czyżyka”. Wersja debug (`BuildConfig.UPDATES_ENABLED = false`) niczego nie sprawdza – ma inny klucz podpisu.

## Risks / Trade-offs

- Przejście z wersji debug wymaga jednorazowej reinstalacji i ponownego parowania (inny klucz podpisu).
- Utrata klucza = koniec aktualizacji w miejscu (znów reinstalacja); klucz trzeba przechowywać poza GitHubem.
- Instalacja w tle zamyka aplikację na chwilę; czytnik powiadomień wraca sam po aktualizacji.
- R8 w wariancie release nie był dotąd budowany – stąd budowanie release w `ci.yml`.
