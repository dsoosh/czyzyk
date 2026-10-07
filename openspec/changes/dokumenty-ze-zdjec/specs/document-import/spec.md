# Spec Delta

## Purpose

Przyjmuje dokumenty sprawdzone na telefonie, ponownie kontroluje obrazy na serwerze i pokazuje dokumenty modelowi analizującemu wiadomości.

## ADDED Requirements

### Requirement: Przyjęcie dokumentu z telefonu
API SHALL przyjmować od sparowanego telefonu dokument dla dostarczonej wiadomości obserwowanej grupy: `image` (JPEG i tekst) albo `text_only` (sam tekst). Dokument dla nieznanej wiadomości MUST dostać odpowiedź „nie znaleziono” (telefon ponowi), obraz inny niż JPEG i decyzja `withheld` MUST być odrzucone. Ten sam obraz (`sha256`) MUST NOT być zapisany dwa razy. Obraz SHALL być dostępny wyłącznie dla serwera; logi i `sync_log` MUST zawierać tylko liczby i rodzaje. Nowy dokument przy przetworzonej wiadomości MUST wrócić ją do analizy.

#### Scenario: Dokument przed wiadomością
- **WHEN** telefon wysyła dokument, zanim serwer dostał wiadomość
- **THEN** odpowiedź to 404, a dokument zostaje przyjęty po dostarczeniu wiadomości

#### Scenario: Ten sam obraz drugi raz
- **WHEN** ten sam obraz przychodzi ponownie
- **THEN** nie powstaje drugi dokument

### Requirement: Kontrola zapasowa na serwerze
Przed analizą grupy każdy nowy obraz dokumentu SHALL zostać sprawdzony modelem z wizją. Gdy model wykryje ludzi albo odmówi odpowiedzi, obraz MUST zostać usunięty, a dokument zachowuje wyłącznie tekst z telefonu. Obraz niesprawdzony MUST NOT trafić do analizy.

#### Scenario: Model widzi dzieci
- **WHEN** kontrola zapasowa zgłasza ludzi na obrazie
- **THEN** obrazu nie ma w bazie, a do analizy trafia tylko tekst

### Requirement: Dokument w analizie wiadomości
Tekst gotowego dokumentu SHALL trafiać do promptu analizy przy wiadomości jako niezaufane dane, a obraz dokumentu nowej wiadomości SHALL trafiać do modelu razem z zapytaniem, oznaczony aliasem wiadomości.

#### Scenario: Plan miesiąca
- **WHEN** dokument z planem zawiera „15.10 – teatrzyk, 20.10 – wycieczka, zabrać prowiant”
- **THEN** analiza tworzy wydarzenia i rzecz do przyniesienia ze źródłem w tej wiadomości
