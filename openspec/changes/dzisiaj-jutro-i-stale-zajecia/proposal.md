# Proposal

## Why

Użytkownik zgłosił kilka potrzeb związanych z planowaniem dnia:
- Cotygodniowe zajęcia w czasie pobytu w przedszkolu (dodatkowy angielski, hiszpański) nie wymagają nic od rodziców, a zaśmiecają kalendarz i listy.
- Zajęcia, na które trzeba zapisywać dziecko osobno (filcowanie, geologia), mają zostać w kalendarzu. Sama prośba o zapisy ma być w „Wymaga odpowiedzi”, z oznaczeniem, gdy to ankieta.
- Ekran główny ma pokazywać cały dzień: zamiast „Na dziś przynieść” sekcje „Dzisiaj” i „Jutro” (gdzie zawieźć dziecko, wydarzenia, co przynieść), reszta bez zmian.
- Główne miejsca, do których zawozi się dzieci (Pęgów, Baza, Witosa, OOK, Kino, Dworzec), mają być odróżnialne ikoną lub tagiem.

Zmiana na prośbę użytkownika. **Gotowe, gdy:**
- stałe zajęcia w czasie pobytu nie są w kalendarzu, na listach, w skrótach ani w kalendarzu subskrybowanym;
- prośby o zapisy i ankiety są w „Wymaga odpowiedzi” z tagiem;
- ekran główny ma „Dzisiaj” i „Jutro”;
- miejsca przyprowadzenia mają ikony.

## What Changes

- **Baza:** `events.in_hours` i `action_required.kind` (`signup` / `survey`); widok `family_action_required` odtworzony. Migracja `0040_routine_classes_and_signups.sql`.
- **Analiza:**
  - pole wydarzenia `in_hours` i pole sprawy `kind`;
  - reguła 16 rozróżnia stałe zajęcia w czasie pobytu, zajęcia z zapisami i ankiety;
  - reguła 20 prosi o krótkie nazwy miejsc w `drop_offs`;
  - kontekst analizy pokazuje `in_hours` i `kind`.
- **Kalendarz:** wydarzenia `in_hours` poza dniami, w zwiniętej liście „Stałe zajęcia w przedszkolu” na dole widoku listy.
- **Ekran główny:**
  - sekcje „Dzisiaj” i „Jutro” z datą i podsekcjami „Gdzie zawieźć”, „Wydarzenia”, „Co przynieść” oraz informacją o dniu wolnym;
  - pusty dzień to „Zwykły dzień w przedszkolu”;
  - „W najbliższych dniach” i „Wydarzenia” zaczynają się od pojutrza;
  - płatności i „Wymaga odpowiedzi” bez zmian.
- **Tagi miejsc:** `PlaceTag` rozpoznaje Bazę, Witosa, Pęgów, OOK, Kino i Dworzec (ikona, kolor). Inne miejsca dostają 📍 i nazwę. Tagi są na ekranie głównym, w kalendarzu i w podglądzie wydarzenia.
- **„Wymaga odpowiedzi”:** tag „Zapisy” albo „Ankieta”.
- **Skróty push i kalendarz subskrybowany:** bez wydarzeń `in_hours`.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `event-plan`: stałe zajęcia, zapisy i ankiety, ekran „Dzisiaj/Jutro”, tagi miejsc.

## Impact

- Baza: `0040_routine_classes_and_signups.sql`.
- Shared: `extraction.ts`, `prompts.ts`.
- Worker:
  - `extraction/apply.ts`;
  - `extraction/batch.ts`;
  - `push/digest.ts`.
- API: `ical/routes.ts`.
- PWA:
  - `TodayPage`;
  - `CalendarPage`;
  - `EventPage`;
  - `ActionsPage`;
  - `PlaceTag`;
  - `KindTag`;
  - `lib/items.ts`.
