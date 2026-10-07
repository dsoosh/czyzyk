# Tasks

## 1. Baza

- [x] 1.1 Migracja `0025_event_history`: `attachment_image` (tylko rodzina, tylko sprawdzone obrazy); weryfikacja: `supabase/tests/event-history.test.ts`

## 2. PWA

- [x] 2.1 `fetchEventHistory`, `fetchDocumentImage`, wspólne `lib/changes.ts`; weryfikacja: `npm run typecheck`
- [x] 2.2 Sekcja „Historia” na ekranie wydarzenia (oś czasu, zdjęcia, tekst dokumentów, zmiany rzeczy do przyniesienia); weryfikacja: `CalendarPage.test.tsx`
- [ ] 2.3 Test ręczny na produkcji: wydarzenie ze zmianą godziny i zdjęciem plakatu; weryfikacja: użytkownik
