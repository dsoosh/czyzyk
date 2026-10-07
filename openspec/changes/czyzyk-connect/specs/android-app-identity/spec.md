## ADDED Requirements

### Requirement: Nazwa aplikacji Android odróżniona od PWA
Aplikacja Android SHALL nazywać się „Czyżyk Connect” i mieć identyfikator pakietu `pl.czyzyk.connect`, a wydania SHALL publikować plik `czyzyk-connect.apk`. Instalacja aplikacji Android MUST NOT kolidować z PWA „Czyżyk” zainstalowaną z przeglądarki.

#### Scenario: Obie aplikacje na telefonie
- **WHEN** na telefonie jest PWA „Czyżyk” z przeglądarki i użytkownik instaluje `czyzyk-connect.apk`
- **THEN** instalacja się udaje, a na ekranie są dwie różnie nazwane ikony: „Czyżyk” i „Czyżyk Connect”

#### Scenario: Udostępnianie eksportu
- **WHEN** użytkownik eksportuje czat z WhatsAppa
- **THEN** w menu Udostępnij widzi „Czyżyk Connect”
