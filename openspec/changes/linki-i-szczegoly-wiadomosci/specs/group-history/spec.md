## ADDED Requirements

### Requirement: Klikalne linki w wiadomościach
Linki `http` i `https` (oraz adresy zaczynające się od `www.`) w treści wiadomości SHALL być klikalne i wyświetlane pod krótką nazwą: serwis (np. „YouTube”, „Formularz Google”) albo domena, z pełnym adresem w podpowiedzi. Linki MUST otwierać się poza aplikacją bez przekazywania odsyłacza; inne schematy MUST NOT być linkowane.

#### Scenario: Formularz zapisów
- **WHEN** wiadomość zawiera `https://forms.gle/xyz`
- **THEN** w historii grupy widać link „🔗 Formularz Google” prowadzący pod ten adres

### Requirement: Szczegóły wiadomości w czacie
Kliknięcie wiadomości w historii grupy SHALL pokazywać werdykt analizy (czeka, pominięta przez reguły lub wstępną ocenę, przeanalizowana) i sprawy, które wiadomość utworzyła, zmieniła lub odwołała, z linkami do nich. Adminowi SHALL pokazywać też wywołania modelu dotyczące tej wiadomości z linkiem do wpisu w dzienniku.

#### Scenario: Wiadomość o zebraniu
- **WHEN** admin klika wiadomość, z której powstało wydarzenie
- **THEN** widzi „Przeanalizowana”, link „Wydarzenie: Zebranie” oraz linki do wstępnej oceny i analizy w dzienniku LLM
