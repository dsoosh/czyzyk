# Design

## Decisions

### D1. Formy imienia przy dziecku
Kolumna `children.aliases text[]` (do 10, każda do 40 znaków). `save_child(p_id, p_name, p_group_id, p_aliases default '{}')` przycina formy, usuwa puste, powtórzenia i samo imię. `child_name_forms(name, aliases)` zwraca imię i formy małymi literami; zapis odrzuca formę, która jest imieniem lub formą innego dziecka – jedna forma wskazuje jedno dziecko.

### D2. Model widzi formy, zapisuje główne imię
W bloku `<dzieci>`: `"Elena" (inne formy imienia: "Eleonora", "El", "Elcia") – grupa "Motylki"`. Model wpisuje w `children` główne imię; przy zapisie przypisanie dopasowuje też formy (`child_name_forms && …`), więc „Elcia” od modelu i tak trafia do Eleny.

### D3. Lista imion i rzecz bez dnia – reguły promptu
Lista imion przy prośbie zawęża ją do wymienionych dzieci: dziecko rodziny na liście → element z przypisaniem; lista dzieci rodziny niepusta i nikogo z nich na liście → brak elementu. Rzecz do przyniesienia bez dnia → termin na najbliższy dzień roboczy po wysłaniu (żeby trafiła na ekran „Dziś”).

### D4. Ponowna analiza
Kontekst obejmuje też wiadomości już przeanalizowane, napisane po pierwszej analizowanej (blok `<wiadomosci_pozniejsze>`, do limitu kontekstu) – przy zwykłej analizie nowych wiadomości ten blok jest pusty i go nie ma.

`admin_reprocess_message(id)` (tylko admin) zeruje `processed_at` i wysyła `message_ingested` z identyfikatorem grupy; worker analizuje wiadomość jak nową, z istniejącymi elementami w kontekście (aktualizuje zamiast dublować).

## Risks / Trade-offs

- Reguła „nikogo z rodziny na liście → brak elementu” może przegapić prośbę do wszystkich zapisaną jako lista – akceptowalne; przypadek jest w zestawie ewaluacyjnym.
- Termin „najbliższy dzień roboczy” to przybliżenie dla próśb bez dnia.
