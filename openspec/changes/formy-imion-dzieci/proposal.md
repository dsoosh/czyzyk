# Proposal

## Why

Wiadomość z wypunktowaną listą imion („- Elena”, „- Wojtek”, …) i prośbą „o zakup i doniesienie sprayu przeciwko insektom” nie dała rodzinie rzeczy do przyniesienia dla Eleny. Do tego dzieci bywają nazywane różnie: Elena to też Eleonora, El, Elcia; Wicek to Wincenty, Wicuś, Wic – a system zna tylko jedno imię. Prośba nie miała też dnia, a rzecz bez terminu nie pojawia się na ekranie „Dziś”.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** przy dziecku można wpisać inne formy imienia, analiza rozpoznaje dziecko po każdej z nich i na liście imion, prośba bez dnia dostaje termin, a admin może wysłać wiadomość do ponownej analizy.

## What Changes

- Dzieci: pole „Inne formy imienia” (do 10, po przecinku); forma nie może należeć do dwóch dzieci.
- Analiza wiadomości: model dostaje formy imion; dziecko rozpoznaje po każdej z nich; lista imion przy prośbie oznacza, że prośba dotyczy tylko wymienionych dzieci (gdy nie ma wśród nich dziecka rodziny – brak elementu); rzecz bez dnia ma termin na najbliższy dzień roboczy. Zapis przypisania przyjmuje też formę imienia.
- Asystent widzi formy imion dzieci.
- Admin: „Analizuj ponownie” przy wiadomości w historii grupy.
- Zestaw ewaluacyjny: trzy przypadki list imion (w tym ta wiadomość) i sprawdzanie przypisanych dzieci.

**Poza zakresem:** automatyczna ponowna analiza całej historii po dodaniu formy imienia.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `family-children`: inne formy imienia dziecka.
- `item-extraction`: listy imion, formy imion, termin rzeczy bez dnia, ponowna analiza wiadomości.

## Impact

- Migracja `0013_child_aliases.sql` (kolumna `aliases`, `child_name_forms`, nowa sygnatura `save_child`, `admin_reprocess_message`).
- `services/worker` (batch, prompt, przypisanie dzieci, eval), `services/api` (kontekst asystenta), `apps/pwa` (Dzieci, historia grupy).
- Archiwizacja po `dzieci-rodziny` i etapach tworzących `item-extraction` (tu tylko wymagania ADDED).
