# Tasks

## 1. Baza

- [x] 1.1 Migracja `0024_manual_entry`: źródło `manual`, rodzaj `manual` w `sync_log`, `admin_add_group` (normalizacja, istniejąca grupa włączona, tylko admin); weryfikacja: `supabase/tests/ingest-rpc.test.ts`

## 2. API i parser

- [x] 2.1 `parseChatExport` rozpoznaje format kopiowania z Androida; weryfikacja: `packages/shared/src/chatExport.test.ts`
- [x] 2.2 `POST /import/message`: nagłówki albo pojedyncza wiadomość, deduplikacja, od razu do analizy, dziennik bez treści, tylko admin; weryfikacja: `services/api/src/import/import.db.test.ts`

## 3. PWA

- [x] 3.1 Grupy: „Dodaj grupę”; weryfikacja: `DevicesGroups.test.tsx`
- [x] 3.2 Import: „Wklej wiadomości” (podgląd rozpoznanych nagłówków, autor i czas dla pojedynczej wiadomości, grupa z `?grupa=`), link z historii grupy dla admina; weryfikacja: `ImportPage.test.tsx`
- [ ] 3.3 Test ręczny: dodanie grupy przed pierwszą wiadomością i wklejenie wiadomości na produkcji; weryfikacja: użytkownik
