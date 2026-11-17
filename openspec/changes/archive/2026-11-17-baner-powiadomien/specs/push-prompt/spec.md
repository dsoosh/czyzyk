# Spec Delta

## Purpose

Każdy członek rodziny może włączyć powiadomienia jednym stuknięciem, bez szukania ich w Ustawieniach.

## ADDED Requirements

### Requirement: Baner zachęty do powiadomień
PWA SHALL pokazywać nad treścią strony baner „Włącz powiadomienia”, gdy przeglądarka obsługuje push, push jest skonfigurowany, na urządzeniu nie ma subskrypcji, a zgoda na powiadomienia nie została odrzucona. Baner MUST NOT pojawiać się na stronie Ustawień ani w przeglądarce bez obsługi push. PWA MUST NOT prosić o zgodę bez stuknięcia użytkownika.

#### Scenario: Pierwsze uruchomienie
- **WHEN** członek rodziny otwiera „Dziś” na telefonie z Androidem w Chrome i nie włączał powiadomień
- **THEN** widzi baner „Włącz powiadomienia” i żadne okienko zgody nie pojawia się samo

#### Scenario: Włączenie z banera
- **WHEN** użytkownik stuka „Włącz” i zgadza się w okienku przeglądarki
- **THEN** urządzenie jest zasubskrybowane z domyślnymi ustawieniami, a baner znika

#### Scenario: Zgoda odrzucona
- **WHEN** przeglądarka ma odrzuconą zgodę na powiadomienia dla Czyżyka
- **THEN** baner się nie pojawia

#### Scenario: Aplikacja na Androidzie
- **WHEN** PWA działa w aplikacji Czyżyk Connect, gdzie nie ma Web Push
- **THEN** baner się nie pojawia

### Requirement: Odłożenie banera
Baner SHALL mieć przycisk „Nie teraz”, który chowa go na tym urządzeniu na 30 dni.

#### Scenario: Nie teraz
- **WHEN** użytkownik stuka „Nie teraz”
- **THEN** baner znika i nie wraca przez 30 dni, a po tym czasie pojawia się ponownie

### Requirement: Baner na iPhonie bez instalacji
Na iPhonie w Safari bez instalacji na ekranie początkowym baner SHALL zamiast prośby o zgodę rozwijać instrukcję „Udostępnij → Do ekranu początkowego”.

#### Scenario: iPhone w przeglądarce
- **WHEN** użytkownik iPhone'a w Safari stuka „Włącz” na banerze
- **THEN** widzi instrukcję dodania aplikacji do ekranu początkowego, a prośba o zgodę nie jest wysyłana
