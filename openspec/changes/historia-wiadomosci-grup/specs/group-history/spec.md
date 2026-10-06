## ADDED Requirements

### Requirement: Lista śledzonych grup
PWA SHALL pokazywać członkom rodziny listę śledzonych grup z nazwą wyświetlaną (albo nazwą z WhatsAppa, gdy admin jej nie nadał) oraz czasem i autorem ostatniej wiadomości. Grupy nieśledzone MUST NOT pojawiać się na liście.

#### Scenario: Dwie śledzone grupy
- **WHEN** admin śledzi grupy „Motylki” i „Rada rodziców”, a grupa „Sąsiedzi” jest nieśledzona
- **THEN** zakładka „Czaty” pokazuje „Motylki” i „Rada rodziców” z ostatnią wiadomością każdej, bez „Sąsiadów”

### Requirement: Historia wiadomości grupy
PWA SHALL pokazywać wiadomości wybranej grupy od najnowszych, w porcjach po 50, z autorem, dniem i godziną (Europe/Warsaw), oznaczeniem załącznika i wiadomości prawdopodobnie usuniętej. Starsze wiadomości MUST dać się doczytać. Treść MUST być wyświetlana jako zwykły tekst. Dostęp MUST wynikać z polityk bazy (tylko członkowie rodziny).

#### Scenario: Długa historia
- **WHEN** grupa ma 120 wiadomości, a członek rodziny otwiera jej historię
- **THEN** widzi 50 najnowszych, a po „Wcześniejsze wiadomości” – 100 najnowszych

#### Scenario: Osoba spoza rodziny
- **WHEN** zalogowana osoba bez profilu rodziny próbuje odczytać wiadomości grupy
- **THEN** baza zwraca pusty wynik

### Requirement: Wyszukiwanie w historii grupy
PWA SHALL pozwalać przeszukać wiadomości wybranej grupy po fragmencie treści, bez rozróżniania wielkości liter.

#### Scenario: Szukanie wycieczki
- **WHEN** członek rodziny wpisuje „wycieczk” w historii grupy „Motylki”
- **THEN** widzi tylko wiadomości tej grupy zawierające ten fragment, od najnowszych
