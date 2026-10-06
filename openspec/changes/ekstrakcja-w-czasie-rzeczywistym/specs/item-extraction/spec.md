## MODIFIED Requirements

### Requirement: Moment ekstrakcji
System SHALL przekazywać nieprzetworzone wiadomości grupy do ekstrakcji zaraz po ich przyjęciu – z powiadomienia telefonu albo z importu eksportu czatu – po krótkim, skonfigurowanym opóźnieniu zbierającym serię wiadomości (domyślnie 15 sekund). Wiadomości przyjęte w czasie tego opóźnienia MUST trafić do tej samej ekstrakcji. Wiadomość przyjęta w trakcie trwającej ekstrakcji grupy MUST zostać przetworzona w kolejnej ekstrakcji, bez czekania na następne wiadomości. Gdy natychmiastowe uruchomienie zawiedzie (np. restart usługi), ekstrakcja MUST rozpocząć się najpóźniej 2 minuty po przyjęciu wiadomości.

#### Scenario: Seria wiadomości
- **WHEN** w grupie przychodzą trzy wiadomości w odstępach po 3 sekundy
- **THEN** wszystkie trzy trafiają do modelu w jednej ekstrakcji, rozpoczętej kilkanaście sekund po pierwszej

#### Scenario: Wiadomość w trakcie ekstrakcji
- **WHEN** w czasie trwającej ekstrakcji grupy przychodzi nowa wiadomość
- **THEN** zaraz po zakończeniu bieżącej ekstrakcji rozpoczyna się kolejna, z tą wiadomością

#### Scenario: Import eksportu
- **WHEN** admin importuje eksport czatu z wiadomościami z ostatnich dni
- **THEN** ekstrakcja nowych wiadomości tej grupy rozpoczyna się kilkanaście sekund po zakończeniu importu

#### Scenario: Kryterium etapu
- **WHEN** Pani Ania pisze w śledzonej grupie „W piątek bal, przebrania”
- **THEN** w ciągu 2 minut PWA pokazuje wydarzenie „Bal” w najbliższy piątek oraz rzecz do przyniesienia „przebranie” na ten dzień
