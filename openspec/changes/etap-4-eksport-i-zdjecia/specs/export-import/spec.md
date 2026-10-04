# Spec Delta

## Purpose

Zamienia przefiltrowaną paczkę eksportu na wiadomości i załączniki-dokumenty w bazie, uzupełniając luki po powiadomieniach bez tworzenia duplikatów.

## ADDED Requirements

### Requirement: Parsowanie `_chat.txt`
System SHALL parsować plik czatu z eksportu w formatach daty zależnych od języka telefonu (co najmniej polski i angielski, zegar 24- i 12-godzinny), z wiadomościami wieloliniowymi, komunikatami systemowymi (pomijanymi jako wiadomości) i znacznikami załączników.

#### Scenario: Wiadomość wieloliniowa
- **WHEN** wiadomość w `_chat.txt` ma trzy linie, z których tylko pierwsza zaczyna się datą
- **THEN** powstaje jedna wiadomość z treścią trzech linii

#### Scenario: Format angielski 12-godzinny
- **WHEN** linia ma postać `10/9/26, 8:15 PM - Anna: See you`
- **THEN** wiadomość ma czas 9 października 2026, 20:15 czasu Europe/Warsaw

#### Scenario: Komunikat systemowy
- **WHEN** linia to „Wiadomości i połączenia są szyfrowane…” albo „Anna dodała Piotra”
- **THEN** nie powstaje wiadomość

### Requirement: Załączniki zgodnie z manifestem
Każdy znacznik załącznika SHALL zostać rozstrzygnięty według manifestu paczki: `image` – zapis obrazu dokumentu w magazynie i powiązanie z wiadomością; `text_only` – zapis samego tekstu rozpoznanego na telefonie, bez pliku; `withheld` – wiadomość oznaczona jako mająca załącznik, bez pliku i bez treści. Plik obecny w paczce, a niewymieniony w manifeście z decyzją `image`, MUST zostać odrzucony i nie zapisany.

#### Scenario: Dokument
- **WHEN** linia zawiera `IMG-20261009-WA0003.jpg (plik załączony)`, a manifest ma dla niego decyzję `image`
- **THEN** wiadomość ma załącznik-dokument z obrazem w magazynie

#### Scenario: Zdjęcie wstrzymane
- **WHEN** manifest ma dla załącznika decyzję `withheld`
- **THEN** wiadomość ma flagę załącznika i opis „załącznik pozostał na telefonie”, a w magazynie nie ma pliku

#### Scenario: Plik spoza manifestu
- **WHEN** paczka zawiera plik obrazu bez wpisu `image` w manifeście
- **THEN** plik nie jest zapisywany, a dziennik synchronizacji odnotowuje niezgodność paczki

### Requirement: Scalanie z powiadomieniami
Wiadomość z eksportu o tym samym kluczu dopasowania co wiadomość z powiadomienia SHALL zostać z nią scalona: wersja z eksportu wygrywa (treść, załącznik, źródło `export`), a identyfikator i powiązania elementów MUST pozostać bez zmian. Ponowny import tej samej paczki MUST NOT tworzyć duplikatów wiadomości ani dokumentów.

#### Scenario: Dokument znany z powiadomienia
- **WHEN** powiadomienie zapisało „📷 Zdjęcie” z flagą załącznika, a eksport zawiera tę wiadomość z dokumentem
- **THEN** istnieje jedna wiadomość ze źródłem `export` i załącznikiem-dokumentem

#### Scenario: Luka po wyciszonej grupie
- **WHEN** eksport zawiera wiadomości, których nie było w powiadomieniach
- **THEN** zostają dodane jako nowe wiadomości ze źródłem `export`

### Requirement: Przetwarzanie po imporcie
Po imporcie paczki system SHALL od razu uruchomić ekstrakcję dla nowych i scalonych wiadomości grupy oraz ich dokumentów (bez czekania na okno ciszy), zaktualizować czas ostatniego eksportu grupy i usunąć paczkę z magazynu.

#### Scenario: Paczka przetworzona
- **WHEN** import paczki kończy się powodzeniem
- **THEN** paczka nie istnieje w magazynie, a grupa ma zaktualizowany czas ostatniego eksportu

### Requirement: Błędna paczka
Paczka, której nie da się rozpakować, sparsować albo której brakuje manifestu, SHALL zostać oznaczona jako błędna w dzienniku synchronizacji z nazwą kroku; wiadomości i pliki z niej MUST NOT być częściowo zapisane.

#### Scenario: Uszkodzony ZIP
- **WHEN** paczka jest uszkodzona
- **THEN** dziennik synchronizacji zawiera błąd „krok: rozpakowanie”, a w bazie nie pojawiają się wiadomości z tej paczki
