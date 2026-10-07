## ADDED Requirements

### Requirement: Sprawy innych grup w analizie
Analiza wiadomości grupy, do której chodzi dziecko rodziny, SHALL otrzymywać aktywne wydarzenia, rzeczy do przyniesienia, płatności i sprawy wymagające odpowiedzi z innych śledzonych grup, do których chodzą dzieci rodziny, oznaczone nazwą grupy. Sprawy grup bez dzieci rodziny MUST NOT trafiać do tej analizy.

#### Scenario: Dwoje dzieci w różnych grupach
- **WHEN** analizowana jest wiadomość grupy Zosi, a Antek chodzi do grupy Sowy
- **THEN** model widzi aktywne sprawy grupy Sowy z dopiskiem grupy

#### Scenario: Grupa rodziców
- **WHEN** w grupie bez dzieci rodziny jest zapowiedziane zebranie
- **THEN** analiza grupy Zosi go nie widzi

### Requirement: Dołączenie dziecka do wspólnej sprawy
Gdy wiadomość zapowiada tę samą sprawę co sprawa innej grupy, system SHALL dopisać do tej sprawy dzieci analizowanej grupy (wymienione w wiadomości albo wszystkie dzieci rodziny z tej grupy) i wiadomości źródłowe, zamiast tworzyć nową sprawę. Dołączenie MUST NOT zmieniać treści, grupy ani statusu sprawy i SHALL zapisać zmianę dzieci w historii sprawy. Sprawy innej grupy MUST NOT być zmieniane ani odwoływane na podstawie wiadomości tej grupy.

#### Scenario: Wspólna wycieczka
- **WHEN** wycieczka do Zajezdni 14.10 jest już w grupie Antka, a ta sama wycieczka przychodzi w grupie Zosi
- **THEN** jest jedno wydarzenie z dziećmi Antek i Zosia, a w historii widać dopisanie Zosi

#### Scenario: Próba zmiany cudzej sprawy
- **WHEN** model próbuje zmienić tytuł wydarzenia z innej grupy
- **THEN** operacja jest odrzucona, a wydarzenie zostaje bez zmian
