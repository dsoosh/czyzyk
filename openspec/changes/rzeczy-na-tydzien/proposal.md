# Proposal

## Why

Rodzina pakuje się zwykle rano, a ekran główny pokazuje tylko rzeczy „na jutro” – rano znikają z niego rzeczy na dziś. Lista tylko na jutro nie pozwala też przygotować się wcześniej (np. kupić coś na wycieczkę za kilka dni).

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** ekran główny pokazuje rzeczy na dziś oraz osobno rzeczy na najbliższe 7 dni, posortowane po dacie.

## What Changes

- Ekran „Dziś i jutro”: sekcja „Na dziś przynieść” (termin dziś) i sekcja „W najbliższych dniach” (termin od jutra do 7 dni naprzód) zamiast „Na jutro przynieść”; druga lista posortowana po dacie, z etykietą dnia („jutro”, „pt 16.10”). Obie są checklistami pakowania.
- Asystent dla ekranu głównego dostaje rzeczy i wydarzenia na te same 7 dni, które widzi rodzina.

**Poza zakresem:** wieczorny skrót push (dalej „na jutro”).

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `today-view`: sekcje rzeczy do przyniesienia (dziś + najbliższe 7 dni) i checklista w obu.

## Impact

- `apps/pwa` (`fetchToday`, `TodayPage`), `services/api` (kontekst asystenta dla widoku `today`).
- Archiwizacja po `etap-2-pierwszy-przeplyw-danych` i `etap-3-codzienne-uzycie` (wymagania MODIFIED).
