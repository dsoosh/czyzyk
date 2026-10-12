# Proposal

## Why

Wspólne wydarzenie dwóch grup (dołączone operacją `join`) pokazuje się w kalendarzu jako wydarzenie jednej grupy, bo PWA wyświetla tylko główną grupę sprawy. Użytkownik zgłosił, że w kalendarzu wspólne wydarzenia wyglądają jak wydarzenia jednej grupy.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** wydarzenia i sprawy wspólne kilku grup pokazują wszystkie te grupy (np. „Wilki, Sowy”).

## What Changes

- Nowa funkcja `itemGroupsLabel` w PWA zwraca główną grupę sprawy i grupy dołączone, rozdzielone przecinkiem.
- Korzystają z niej: kalendarz, strona wydarzenia, „Dziś” oraz listy rzeczy, płatności i „Wymaga odpowiedzi”.
- Dni wolne bez zmian (nie mają grup dołączonych).

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `families`: grupy wspólnej sprawy widoczne w PWA.

## Impact

- PWA:
  - `lib/items.ts`;
  - `CalendarPage`;
  - `EventPage`;
  - `TodayPage`;
  - listy.
- Test: `CalendarPage.test.tsx`.
