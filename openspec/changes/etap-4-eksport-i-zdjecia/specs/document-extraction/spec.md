# Spec Delta

## Purpose

Wyciąga wydarzenia, rzeczy do przyniesienia, płatności i inne elementy z dokumentów przedszkola (plany, jadłospisy, plakaty, ogłoszenia), które dotarły jako obraz bez ludzi albo jako tekst rozpoznany na telefonie.

## ADDED Requirements

### Requirement: Ekstrakcja z dokumentów
Dla każdego nowego załącznika `image` (obraz) i `text_only` (tekst) system SHALL wyciągać elementy w tym samym formacie i z tymi samymi zasadami co ekstrakcja tekstu (operacje, pewność, przegląd, walidacja, treść jako niezaufane dane), uwzględniając tekst sąsiednich wiadomości. Elementy MUST wskazywać wiadomość z dokumentem jako źródło, a dokument otrzymuje krótki opis po polsku.

#### Scenario: Kryterium etapu – plan miesiąca
- **WHEN** zdjęcie planu miesiąca zawiera „15.10 – teatrzyk, 22.10 – dzień kropki”
- **THEN** w kalendarzu pojawiają się wydarzenia 15.10 „Teatrzyk” i 22.10 „Dzień kropki”, a ich źródłem jest wiadomość z tym dokumentem

#### Scenario: Plakat jako tekst
- **WHEN** z plakatu z dziećmi dotarł tylko tekst „Bal jesienny 24.10, przebrania mile widziane”
- **THEN** powstaje wydarzenie „Bal jesienny” 24.10 i rzecz „przebranie”

### Requirement: Kontrola zapasowa na serwerze
Jeżeli model analizujący obraz dokumentu rozpozna na nim ludzi, system SHALL natychmiast usunąć obraz i jego miniaturę z magazynu, zachować wyłącznie wyciągnięty tekst i odnotować zdarzenie w dzienniku synchronizacji (bez treści), aby można było poprawić progi na telefonie.

#### Scenario: Dziecko w rogu zdjęcia planu
- **WHEN** model zgłasza, że na obrazie dokumentu widać dziecko
- **THEN** obraz znika z magazynu, dokument zostaje tylko jako tekst, a admin widzi wpis „kontrola zapasowa: usunięto obraz”

### Requirement: Podgląd dokumentu źródłowego
Widok „skąd to wiem” SHALL pokazywać obraz dokumentu (przez podpisany URL ważny najwyżej 1 godzinę, wyłącznie dla członków rodziny) albo jego tekst, gdy dotarł tylko tekst.

#### Scenario: Źródło z planu miesiąca
- **WHEN** użytkownik otwiera źródło wydarzenia „Teatrzyk”
- **THEN** widzi miniaturę planu miesiąca z możliwością powiększenia

#### Scenario: Osoba spoza rodziny prosi o obraz
- **WHEN** sesja bez profilu rodziny prosi o podpisany URL dokumentu
- **THEN** żądanie jest odrzucone

### Requirement: Deduplikacja dokumentów
Ten sam dokument wysłany ponownie (identyczny plik) SHALL NOT być zapisywany ani analizowany drugi raz.

#### Scenario: Plan wysłany dwa razy
- **WHEN** ten sam plik planu pojawia się w dwóch eksportach
- **THEN** w magazynie istnieje jedna kopia, a ekstrakcja nie tworzy duplikatów wydarzeń
