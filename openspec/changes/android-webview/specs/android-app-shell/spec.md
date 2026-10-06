## ADDED Requirements

### Requirement: PWA jako główny widok aplikacji Android
Aplikacja Android SHALL po uruchomieniu pokazywać PWA Czyżyka w osadzonym widoku, gdy adres PWA jest znany, a w przeciwnym razie ekran „Ustawienia telefonu” (parowanie, uprawnienia, kolejka, synchronizacja). Ekran ustawień telefonu MUST być dostępny z poziomu PWA i z ekranu błędu ładowania. Widok MUST otwierać w nim tylko strony z adresu PWA; pozostałe adresy MUST trafiać do przeglądarki telefonu.

#### Scenario: Pierwsze uruchomienie bez adresu PWA
- **WHEN** właściciel uruchamia aplikację, która nie zna adresu PWA
- **THEN** widzi ekran „Ustawienia telefonu” z polem na adres aplikacji i parowaniem

#### Scenario: Parowanie podaje adres PWA
- **WHEN** admin generuje w PWA link parowania, a właściciel go skanuje
- **THEN** aplikacja zapisuje adres serwera, token i adres PWA, po czym pokazuje PWA

#### Scenario: Ustawienia telefonu z PWA
- **WHEN** w aplikacji Android właściciel otwiera w PWA Ustawienia i stuka „Ustawienia telefonu”
- **THEN** widzi natywny ekran telefonu, a Wstecz wraca do PWA

### Requirement: Logowanie Google w aplikacji Android
PWA uruchomiona w aplikacji Android SHALL logować przez Google w przeglądarce telefonu i wracać do aplikacji przez `czyzyk://auth/callback`, po czym aplikacja MUST dokończyć logowanie w swoim widoku PWA. W zwykłej przeglądarce logowanie MUST działać jak dotąd.

#### Scenario: Logowanie w aplikacji
- **WHEN** właściciel stuka w aplikacji „Zaloguj przez Google”
- **THEN** otwiera się przeglądarka z logowaniem Google, a po nim aplikacja pokazuje zalogowaną PWA
