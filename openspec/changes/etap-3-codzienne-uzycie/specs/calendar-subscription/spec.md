# Spec Delta

## Purpose

Pozwala każdemu członkowi rodziny widzieć wydarzenia i dni wolne przedszkola w jego własnym kalendarzu (Google, Apple, Outlook) bez otwierania aplikacji.

## ADDED Requirements

### Requirement: Prywatny link subskrypcji
Każdy członek rodziny SHALL móc wygenerować własny link `GET /ical/{token}.ics`. Token MUST być losowy (co najmniej 256 bitów), przechowywany jako hash i pokazany tylko w momencie wygenerowania; wygenerowanie nowego linku MUST unieważniać poprzedni.

#### Scenario: Wygenerowanie linku
- **WHEN** użytkownik w ustawieniach stuka „Dodaj do mojego kalendarza”
- **THEN** widzi link z przyciskami „Google”, „Apple”, „Outlook” i „Kopiuj”

#### Scenario: Unieważnienie
- **WHEN** użytkownik unieważnia link lub generuje nowy
- **THEN** stary link zwraca 404

### Requirement: Zawartość feedu
Feed SHALL zawierać wyłącznie aktywne wydarzenia i dni wolne (tytuł, termin, miejsce, nazwa grupy, stały UID). Feed MUST NOT zawierać treści wiadomości, autorów, zdjęć ani elementów `needs_review` i `cancelled`.

#### Scenario: Odwołane wydarzenie
- **WHEN** wydarzenie zostaje odwołane
- **THEN** przy kolejnym pobraniu feedu nie ma go w pliku, a kalendarz klienta je usuwa

#### Scenario: Prywatność feedu
- **WHEN** feed jest pobierany
- **THEN** opis wydarzenia nie zawiera treści żadnej wiadomości

### Requirement: Utrata dostępu unieważnia feed
Link iCal osoby usuniętej z listy dozwolonych SHALL przestać działać.

#### Scenario: Usunięty członek rodziny
- **WHEN** admin usuwa e-mail z listy dozwolonych
- **THEN** link iCal tej osoby zwraca 404
