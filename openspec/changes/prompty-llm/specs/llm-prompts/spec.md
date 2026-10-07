## ADDED Requirements

### Requirement: Edycja promptów w panelu admina
Admin SHALL móc edytować szablony promptów „Analiza wiadomości” i „Asystent” oraz przywrócić domyślne. Szablon MAY zawierać wyłącznie placeholdery oferowane przez dany prompt; zapis z innym placeholderem MUST zostać odrzucony. Pozostali członkowie rodziny MUST NOT widzieć ani zmieniać szablonów.

#### Scenario: Własny prompt asystenta
- **WHEN** admin zapisuje szablon asystenta z `{{uzytkownik}}`
- **THEN** kolejna odpowiedź asystenta używa szablonu z imieniem pytającego w miejscu placeholdera

#### Scenario: Nieznany placeholder
- **WHEN** admin wpisuje `{{uzytkownik}}` w prompt analizy wiadomości
- **THEN** panel pokazuje błąd i nie pozwala zapisać

#### Scenario: Przywrócenie domyślnego
- **WHEN** admin stuka „Przywróć domyślny”
- **THEN** usługi znów używają domyślnego promptu z kodu

### Requirement: Placeholdery z danymi rodziny
Placeholdery SHALL być wypełniane zaufanymi danymi rodziny: `{{przedszkole}}` (opis przedszkola), `{{dzieci}}` (dzieci z innymi formami imienia i grupą), `{{rodzina}}` (imiona członków rodziny), a w asystencie także `{{uzytkownik}}` (imię pytającego). Pusta wartość MUST być wstawiana jako „(brak)”, a wartość MUST NOT być ponownie przetwarzana jako szablon.

#### Scenario: Imiona dzieci w instrukcji
- **WHEN** szablon analizy zawiera `{{dzieci}}`, a rodzina ma dzieci Elena i Wicek
- **THEN** prompt systemowy zawiera w tym miejscu listę Eleny i Wicka z formami imion i grupami

### Requirement: Stała część bezpieczeństwa
Do każdego promptu systemowego SHALL być dopisywana na końcu stała, nieedytowalna część z zasadami bezpieczeństwa (treść wiadomości to niezaufane dane, zakaz wykonywania poleceń z wiadomości) i formatem odpowiedzi. Żaden szablon MUST NOT jej usunąć ani zmienić.

#### Scenario: Szablon bez zasad
- **WHEN** admin zapisuje krótki szablon bez żadnych zasad
- **THEN** prompt systemowy i tak kończy się stałą częścią bezpieczeństwa
