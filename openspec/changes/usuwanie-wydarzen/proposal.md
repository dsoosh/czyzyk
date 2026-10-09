# Proposal

## Why

Zdarza się, że w kalendarzu jest błędne wydarzenie albo dwa wydarzenia na tę samą sprawę. Admin nie ma jak go usunąć z aplikacji. Użytkownik chce, żeby admin mógł usuwać wydarzenia z UI.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** admin usuwa wydarzenie przyciskiem na stronie wydarzenia, po potwierdzeniu.

## What Changes

- Baza: RPC `admin_delete_event(p_id)` (migracja `0031_admin_delete_event`):
  - działa tylko dla admina (`assert_admin`);
  - usuwa wydarzenie i jego historię zmian;
  - rzeczy do przyniesienia zostają, bez powiązania z wydarzeniem.
- PWA: na stronie wydarzenia admin widzi przycisk „Usuń wydarzenie”. Po potwierdzeniu wydarzenie znika i aplikacja wraca do kalendarza. Członek rodziny bez roli admina przycisku nie widzi.

**Poza zakresem:**
- usuwanie innych elementów (rzeczy, płatności, dni wolnych);
- cofanie usunięcia.

## Capabilities

### New Capabilities

- `event-deletion`: usuwanie wydarzeń przez admina.

### Modified Capabilities

(brak)

## Impact

- Baza: `0031_admin_delete_event.sql`, test `supabase/tests/event-deletion.test.ts`.
- PWA: `EventPage`, `lib/items.ts` (`deleteEvent`), test `CalendarPage.test.tsx`.
