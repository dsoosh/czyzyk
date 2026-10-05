# Tasks

## 1. Parser

- [x] 1.1 `packages/shared/src/chatExport.ts`: parser (PL/EN, Android/iOS, 24/12 h, wieloliniowe, systemowe, usunięte, załączniki, strefa Europe/Warsaw) i dopasowanie grupy z nazwy pliku; weryfikacja: testy jednostkowe na fixtures w formatach PL i EN

## 2. API

- [x] 2.1 `POST /import/chat` (sesja admina, CORS dla PWA, limit rozmiaru, transakcja, `dedupeKey`, okres ekstrakcji, `last_export_at`, `sync_log` bez treści); weryfikacja: testy na lokalnej bazie (401/403, import, duplikat z powiadomienia, ponowny import, okres ekstrakcji, brak treści w logach)

## 3. PWA

- [x] 3.1 Ekran **Admin → Import**: plik `.txt`/`.zip` (rozpakowanie w przeglądarce, tylko plik czatu), podpowiedź grupy, podgląd, okres ekstrakcji, podsumowanie; weryfikacja: testy komponentu (ZIP ze zdjęciem wysyła tylko tekst, brak pliku czatu, podsumowanie)

## 4. Dokumentacja

- [x] 4.1 `docs/wdrozenie.md`: jak wyeksportować czat z WhatsAppa i wgrać go w PWA; weryfikacja: `npm run spec:validate`
