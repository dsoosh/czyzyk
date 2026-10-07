# Tasks

## 1. Worker

- [x] 1.1 Reguły pogawędki (`isChatter`, `onlyChatter`); weryfikacja: testy jednostkowe (PL, emoji, zdjęcia, rodzina, cyfry, pytania)
- [x] 1.2 Wstępna ocena tanim modelem (`TRIAGE_MODEL`), dziennik LLM i `sync_log`, błąd = analiza; weryfikacja: testy na lokalnej bazie

## 2. Baza i PWA

- [x] 2.1 Migracja `0020_message_triage.sql` (rodzaj `triage`, kolumna `messages.triage`); Admin → LLM pokazuje wstępną ocenę; znacznik w historii grupy dla admina; weryfikacja: testy dostępu, przebiegu i komponentów

## 3. Wdrożenie

- [x] 3.1 `TRIAGE_MODEL` w `.railway/railway.ts`, opis w `docs/wdrozenie.md`; weryfikacja: `npm run spec:validate`
