# Spec Delta

## ADDED Requirements

### Requirement: Wykrywanie wiadomości usuniętych
Wiadomość ze źródłem `notification`, której nie ma w eksporcie tej samej grupy obejmującym jej czas wysłania, SHALL dostać status `deleted_suspected`, a elementy, dla których była jedynym źródłem, MUST przejść na `needs_review`. Wiadomości spoza zakresu czasu eksportu MUST pozostać bez zmian.

#### Scenario: Usunięta informacja o płatności
- **WHEN** powiadomienie zapisało „Zbiórka 20 zł na kwiaty”, a późniejszy eksport obejmujący ten czas nie zawiera tej wiadomości
- **THEN** wiadomość ma status `deleted_suspected`, a płatność „20 zł na kwiaty” trafia do kolejki przeglądu i znika z ekranów rodziny

#### Scenario: Wiadomość nowsza niż eksport
- **WHEN** wiadomość z powiadomienia jest późniejsza niż ostatnia wiadomość w eksporcie
- **THEN** jej status się nie zmienia

#### Scenario: Element z kilkoma źródłami
- **WHEN** usunięta wiadomość jest jednym z dwóch źródeł elementu, a drugie źródło jest aktywne
- **THEN** element pozostaje aktywny
