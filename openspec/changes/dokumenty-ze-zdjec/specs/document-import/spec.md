# Spec Delta

## Purpose

Przyjmuje dokumenty sprawdzone na telefonie razem z importem eksportu czatu, ponownie kontroluje obrazy na serwerze i używa treści dokumentów w ekstrakcji elementów.

## ADDED Requirements

### Requirement: Dokumenty w imporcie eksportu
Import eksportu SHALL przyjmować dokumenty (`image` z obrazem JPEG i tekstem albo `text_only` z samym tekstem) i łączyć je z wiadomością po nazwie pliku załącznika z pliku czatu. Dokument bez pasującej wiadomości, obraz inny niż JPEG oraz decyzja `withheld` MUST być odrzucone bez zapisu. Ten sam obraz (`sha256`) MUST NOT być zapisany dwa razy. Obraz SHALL być dostępny wyłącznie dla serwera; logi i `sync_log` MUST zawierać tylko liczby.

#### Scenario: Import z jadłospisem
- **WHEN** admin importuje eksport, w którym wiadomość ma załącznik `IMG-20261006-WA0001.jpg` z decyzją `image`
- **THEN** wiadomość ma dokument z tekstem i obrazem, a podsumowanie podaje liczbę przyjętych dokumentów

#### Scenario: Ponowny import
- **WHEN** ta sama paczka jest importowana drugi raz
- **THEN** nie powstaje drugi dokument

### Requirement: Kontrola zapasowa na serwerze
Przed ekstrakcją grupy każdy nowy obraz dokumentu SHALL zostać sprawdzony modelem z wizją. Gdy model wykryje ludzi albo odmówi odpowiedzi, obraz MUST zostać usunięty, a dokument zachowuje wyłącznie tekst z telefonu.

#### Scenario: Model widzi dzieci
- **WHEN** kontrola zapasowa zgłasza ludzi na obrazie dokumentu
- **THEN** obrazu nie ma w bazie, a tekst dokumentu zostaje

### Requirement: Treść dokumentu w ekstrakcji
Tekst gotowego dokumentu SHALL trafiać do promptu ekstrakcji przy wiadomości jako niezaufane dane. Nowy dokument przy wiadomości z okresu ekstrakcji MUST spowodować ponowną ekstrakcję tej wiadomości.

#### Scenario: Plan miesiąca
- **WHEN** dokument z planem zawiera „15.10 – teatrzyk, 20.10 – wycieczka, zabrać prowiant”
- **THEN** ekstrakcja tworzy wydarzenia i rzecz do przyniesienia ze źródłem w tej wiadomości
