# Spec Delta

## Purpose

Zamienia paczkę eksportu czatu na wiadomości i załączniki w bazie, uzupełniając luki po powiadomieniach bez tworzenia duplikatów.

## ADDED Requirements

### Requirement: Parsowanie `_chat.txt`
System SHALL parsować plik czatu z eksportu w formatach daty zależnych od języka telefonu (co najmniej polski i angielski, zegar 24- i 12-godzinny), z wiadomościami wieloliniowymi, komunikatami systemowymi (pomijanymi jako wiadomości) i znacznikami załączników powiązanymi z plikami w paczce.

#### Scenario: Wiadomość wieloliniowa
- **WHEN** wiadomość w `_chat.txt` ma trzy linie, z których tylko pierwsza zaczyna się datą
- **THEN** powstaje jedna wiadomość z treścią trzech linii

#### Scenario: Format angielski 12-godzinny
- **WHEN** linia ma postać `10/9/26, 8:15 PM - Anna: See you`
- **THEN** wiadomość ma czas 9 października 2026, 20:15 czasu Europe/Warsaw

#### Scenario: Załącznik
- **WHEN** linia zawiera `IMG-20261009-WA0003.jpg (plik załączony)` i taki plik jest w paczce
- **THEN** wiadomość ma załącznik wskazujący ten plik

#### Scenario: Komunikat systemowy
- **WHEN** linia to „Wiadomości i połączenia są szyfrowane…” albo „Anna dodała Piotra”
- **THEN** nie powstaje wiadomość

### Requirement: Scalanie z powiadomieniami
Wiadomość z eksportu o tym samym kluczu dopasowania co wiadomość z powiadomienia SHALL zostać z nią scalona: wersja z eksportu wygrywa (treść, załączniki, źródło `export`), a identyfikator i powiązania elementów MUST pozostać bez zmian. Ponowny import tej samej paczki MUST NOT tworzyć duplikatów.

#### Scenario: Zdjęcie znane z powiadomienia
- **WHEN** powiadomienie zapisało „📷 Zdjęcie” z flagą załącznika, a eksport zawiera tę wiadomość z plikiem
- **THEN** istnieje jedna wiadomość ze źródłem `export` i załącznikiem

#### Scenario: Luka po wyciszonej grupie
- **WHEN** eksport zawiera wiadomości, których nie było w powiadomieniach
- **THEN** zostają dodane jako nowe wiadomości ze źródłem `export`

### Requirement: Przetwarzanie po imporcie
Po imporcie paczki system SHALL od razu uruchomić ekstrakcję dla nowych i scalonych wiadomości grupy (bez czekania na okno ciszy), zaktualizować czas ostatniego eksportu grupy i usunąć ZIP z magazynu.

#### Scenario: Paczka przetworzona
- **WHEN** import paczki kończy się powodzeniem
- **THEN** ZIP nie istnieje w magazynie, a grupa ma zaktualizowany czas ostatniego eksportu

### Requirement: Błędna paczka
Paczka, której nie da się rozpakować lub sparsować, SHALL zostać oznaczona jako błędna w dzienniku synchronizacji z nazwą kroku; wiadomości z niej MUST NOT być częściowo zapisane.

#### Scenario: Uszkodzony ZIP
- **WHEN** paczka jest uszkodzona
- **THEN** dziennik synchronizacji zawiera błąd „krok: rozpakowanie”, a w bazie nie pojawiają się wiadomości z tej paczki
