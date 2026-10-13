# Proposal

## Why

Przy wyjazdach i wyjściach dziecko często można przyprowadzić wcześniej do jednego miejsca (np. do Bazy od 8:30, na Witosa) albo na konkretną godzinę gdzie indziej (dworzec, kino). Wiadomości nauczycielek podają też plan godzinowy dnia (wyjazd, lekcja, przekąska, powrót). Dziś wydarzenie ma tylko jedno pole „zbiórka” bez godzin, a plan dnia zostaje w treści wiadomości. Użytkownik chce w wydarzeniach rozróżnić, gdzie i do której przyprowadzić dziecko, a w podglądzie wydarzenia widzieć plan godzinowy jako poziomy timeline.

Zmiana na prośbę użytkownika. **Gotowe, gdy:**
- analiza zapisuje przy wydarzeniu miejsca i godziny przyprowadzenia oraz plan dnia;
- podgląd wydarzenia pokazuje je jako listę i poziomy timeline;
- kalendarz, „Dziś”, skróty push i asystent mówią, gdzie przyprowadzić dziecko.

## What Changes

- **Baza:** `events.drop_offs` i `events.schedule` (jsonb, listy). Migracja `0039_event_plan.sql`.
- **Kontrakt analizy:** pola wydarzenia `drop_offs` (`place`, `from`, `until`, maks. 4) i `schedule` (`time`, `end`, `label`, maks. 12). Oba są opcjonalne: `update` bez nich zachowuje zapisane listy.
- **Prompt:** reguła 20 z przykładami („od 8:30 w Bazie, na busa do 8:45”, dwie możliwości zbiórki).
- **Kontekst analizy:** listy pojawiają się przy wydarzeniu tylko, gdy nie są puste.
- **PWA:**
  - w podglądzie wydarzenia wiersz „Przyprowadzenie” z linkiem do mapy dla każdego miejsca (zastępuje „Zbiórka”, gdy jest);
  - sekcja „Plan dnia” jako poziomy timeline: kolorowe odcinki ze strzałkami, godziny i opisy na przemian nad i pod linią, przewijany w bok na telefonie;
  - kalendarz i „Dziś” pokazują „przyprowadzenie: …”;
  - historia zmian formatuje nowe pola.
- **Skróty push i asystent:** informacja o przyprowadzeniu (zamiast samej zbiórki); asystent dostaje też plan dnia.

## Capabilities

### New Capabilities

- `event-plan`: przyprowadzenie dziecka i plan dnia wydarzenia.

### Modified Capabilities

(brak)

## Impact

- Baza: `0039_event_plan.sql`.
- Shared: `extraction.ts`, `prompts.ts`.
- Worker:
  - `extraction/apply.ts`;
  - `extraction/batch.ts`;
  - `push/format.ts`;
  - `push/digest.ts`.
- API: `assistant/context.ts`.
- PWA:
  - `EventTimeline`;
  - `EventPage`;
  - `CalendarPage`;
  - `TodayPage`;
  - `lib/items.ts`;
  - `lib/changes.ts`.
