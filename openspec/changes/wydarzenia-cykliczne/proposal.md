# Proposal

## Why

Stałe zajęcia („basen w każdy wtorek”, „angielski w poniedziałki i środy”) analiza zapisywała jako jedno wydarzenie w najbliższym terminie albo wcale. Rodzina chce je widzieć w kalendarzu, na ekranie „Dziś”, w skrótach i w subskrypcji kalendarza co tydzień.

## What Changes

- Baza: `events.repeat_weekdays` (dni tygodnia ISO) i `events.repeat_until`; funkcja `event_occurrences(od, do)` – wystąpienia wydarzeń w zakresie dni, cyklicznych w ich dni tygodnia, z pominięciem dni wolnych grupy i całego przedszkola.
- Analiza: pole `repeat` w danych wydarzenia i reguła promptu – stałe zajęcia to jedno wydarzenie z powtarzaniem; zmiana dnia lub godziny i zakończenie to aktualizacja; wydarzenie cykliczne zostaje w kontekście, dopóki trwa.
- Skróty push (poranny i wieczorny), subskrypcja kalendarza (osobny wpis na każde wystąpienie w ciągu roku) i asystent „Zapytaj” korzystają z wystąpień.
- PWA: „Dziś”, kalendarz i szczegóły wydarzenia pokazują wystąpienia z opisem „co wt, pt (do 31.01)”.

## Capabilities

### New Capabilities

- `recurring-events`: wydarzenia powtarzane w określone dni tygodnia.

### Modified Capabilities

(brak)

## Impact

- Migracja `0023_recurring_events.sql`; `packages/shared` (schemat danych wydarzenia, prompt); worker (zapis, kontekst, skróty); API (iCal, asystent); PWA (`lib/recurrence.ts`, „Dziś”, kalendarz, wydarzenie).
