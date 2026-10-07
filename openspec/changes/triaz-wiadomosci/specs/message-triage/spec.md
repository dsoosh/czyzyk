# Spec Delta

## Purpose

Ogranicza koszt analizy wiadomości: paczka samej pogawędki nie trafia do pełnej analizy modelem.

## ADDED Requirements

### Requirement: Pogawędka pomijana bez modelu
Paczka nowych wiadomości grupy, w której każda wiadomość jest pogawędką (reakcja, grzeczność, emoji, zdjęcie bez podpisu i dokumentu), SHALL zostać oznaczona jako przetworzona bez wywołania modelu. Wiadomość od rodziny, ze wzmianką o rodzinie, z cyfrą, z pytaniem albo z dokumentem MUST NOT być uznana za pogawędkę.

#### Scenario: Podziękowania
- **WHEN** w grupie pojawiają się „Dziękuję bardzo!” i „👍”
- **THEN** żaden model nie jest wywoływany, a dziennik ma wpis „pominięte (reguły)”

#### Scenario: Podziękowanie z pytaniem
- **WHEN** wiadomość brzmi „Dziękuję, a kiedy zebranie?”
- **THEN** paczka trafia do analizy

### Requirement: Wstępna ocena tanim modelem
Gdy skonfigurowano `TRIAGE_MODEL`, paczka, która nie jest samą pogawędką, SHALL najpierw trafić do krótkiej oceny; ocena „nic organizacyjnego” MUST pominąć pełną analizę. Błąd oceny MUST skutkować pełną analizą. Każda ocena SHALL trafić do dziennika LLM admina.

#### Scenario: Rozmowa rodziców
- **WHEN** rodzice rozmawiają o tym, jak udała się zabawa, a ocena mówi „nie”
- **THEN** pełna analiza się nie odbywa

#### Scenario: Błąd oceny
- **WHEN** wywołanie oceny kończy się błędem
- **THEN** paczka trafia do pełnej analizy

### Requirement: Wynik triażu widoczny w historii
W historii grupy admin SHALL widzieć przy wiadomości pominiętej przez triaż znacznik z powodem („pominięte – pogawędka” albo „pominięte – wstępna ocena”). Ponowna analiza wiadomości MUST usunąć znacznik. Członek rodziny bez roli admina MUST NOT widzieć znaczników.

#### Scenario: Podziękowanie w historii
- **WHEN** admin otwiera historię grupy z wiadomością „Dziękuję!” pominiętą przez reguły
- **THEN** przy wiadomości widzi „pominięte – pogawędka” obok „Analizuj ponownie”
