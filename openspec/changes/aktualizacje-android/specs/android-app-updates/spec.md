## ADDED Requirements

### Requirement: Publikowanie wydań aplikacji Android
System SHALL po każdej zmianie aplikacji Android na gałęzi `main` budować APK podpisany stałym kluczem i publikować go jako wydanie GitHub z opisem wersji (`version.json`: numer, nazwa, tag, SHA-256, rozmiar). Numer wersji MUST rosnąć z każdym wydaniem. Klucz podpisu MUST być przechowywany wyłącznie w sekretach CI, nigdy w repozytorium.

#### Scenario: Merge zmiany w aplikacji
- **WHEN** do `main` trafia zmiana w `apps/android`, a sekrety podpisu są ustawione
- **THEN** powstaje wydanie `android-v<numer>` z `czyzyk.apk` i `version.json`, oznaczone jako najnowsze

#### Scenario: Brak sekretów
- **WHEN** sekrety podpisu nie są ustawione
- **THEN** workflow kończy się ostrzeżeniem i nie publikuje wydania

### Requirement: Automatyczna aktualizacja aplikacji
Aplikacja Android w wersji wydanej SHALL sprawdzać najnowsze wydanie raz dziennie w tle i przy otwarciu (nie częściej niż co 6 godzin), a gdy jest nowsze – pobierać APK wyłącznie z wydania tego repozytorium, weryfikować rozmiar i SHA-256 i instalować je. Plik niezgodny z opisem MUST zostać odrzucony i usunięty. Gdy Android wymaga potwierdzenia, aplikacja SHALL pokazać okno z propozycją instalacji.

#### Scenario: Nowa wersja w tle
- **WHEN** na GitHubie jest wydanie z wyższym numerem niż zainstalowane, Android 12+, a poprzednią wersję zainstalował sam Czyżyk
- **THEN** aplikacja pobiera, weryfikuje i instaluje aktualizację bez pytania

#### Scenario: Wymagane potwierdzenie
- **WHEN** aktualizacja jest pobrana, ale Android wymaga zgody użytkownika
- **THEN** przy otwarciu aplikacji pojawia się okno „Nowa wersja Czyżyka” z przyciskiem „Zainstaluj”, który otwiera systemowe potwierdzenie

#### Scenario: Uszkodzony plik
- **WHEN** suma SHA-256 pobranego APK różni się od `version.json`
- **THEN** plik jest usuwany, nic nie jest instalowane, a kolejne sprawdzenie pobiera go od nowa
