## ADDED Requirements

### Requirement: Nazwa aplikacji Android odróżniona od PWA
Aplikacja Android SHALL nazywać się „Czyżyk Connect” i mieć identyfikator pakietu `pl.czyzyk.connect`, a wydania SHALL publikować plik `czyzyk-connect.apk`. Instalacja aplikacji Android MUST NOT kolidować z PWA „Czyżyk” zainstalowaną z przeglądarki.

#### Scenario: Obie aplikacje na telefonie
- **WHEN** na telefonie jest PWA „Czyżyk” z przeglądarki i użytkownik instaluje `czyzyk-connect.apk`
- **THEN** instalacja się udaje, a na ekranie są dwie różnie nazwane ikony: „Czyżyk” i „Czyżyk Connect”

#### Scenario: Udostępnianie eksportu
- **WHEN** użytkownik eksportuje czat z WhatsAppa
- **THEN** w menu Udostępnij widzi „Czyżyk Connect”

### Requirement: Czyżyk Connect obok PWA z Chrome
Aplikacja „Czyżyk Connect” SHALL mieć ikonę odróżnioną od PWA (znaczek telefonu), a interfejs uruchomiony w niej SHALL pokazywać dopisek „Connect” przy nazwie. Linki do adresu aplikacji (ten sam host, także po `http` lub na innym porcie) MUST pozostawać w aplikacji i MUST NOT być przekazywane systemowi Android, który oddałby je zainstalowanej PWA.

#### Scenario: Otwarcie Czyżyk Connect przy zainstalowanej PWA
- **WHEN** na telefonie jest PWA „Czyżyk” z Chrome i użytkownik otwiera „Czyżyk Connect”
- **THEN** otwiera się Czyżyk Connect z dopiskiem „Connect” przy nazwie, a przechodzenie po aplikacji nie przełącza do PWA

#### Scenario: PWA w przeglądarce
- **WHEN** interfejs działa poza aplikacją Android
- **THEN** przy nazwie nie ma dopisku „Connect”
