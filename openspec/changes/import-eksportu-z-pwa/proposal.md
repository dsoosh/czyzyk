# Proposal

## Why

Do etapu 4 (eksport na klik z telefonu) jedyne źródło danych to powiadomienia, które gubią wiadomości przy otwartym czacie, wyciszonej grupie albo przed instalacją aplikacji. Admin chce móc wgrać historię kanału (eksport czatu z WhatsAppa) ręcznie z panelu w PWA, np. żeby uzupełnić luki albo załadować wiadomości sprzed parowania telefonu.

Zmiana poza kolejnością etapów, na prośbę użytkownika (jak wcześniej start etapu 2 przed archiwizacją etapu 1). Realizuje część etapu 4: parser `_chat.txt` (zadanie 4.1 zmiany `etap-4-eksport-i-zdjecia`) – bez obrazów. **Gotowe, gdy:** admin wgrywa w PWA plik eksportu (`.txt` albo `.zip`) wybranej grupy, nowe wiadomości trafiają do bazy bez duplikatów z powiadomieniami, a świeże z nich przechodzą ekstrakcję.

## What Changes

- PWA: ekran **Admin → Import** – wybór pliku `.txt` lub `.zip` z eksportu czatu, wybór śledzonej grupy (podpowiadanej z nazwy pliku), podgląd (liczba wiadomości, zakres dat), wybór okresu ekstrakcji, podsumowanie importu.
- ZIP jest otwierany w przeglądarce; odczytywany i wysyłany jest wyłącznie plik tekstowy czatu. Zdjęcia, filmy i inne pliki z paczki nigdy nie opuszczają urządzenia.
- `packages/shared`: parser `_chat.txt` (formaty polskie i angielskie, Android i iOS, 24/12 h, wiadomości wieloliniowe, komunikaty systemowe, znaczniki załączników).
- `services/api`: `POST /import/chat` – tylko dla admina (sesja Supabase), parsowanie na serwerze, zapis wiadomości ze źródłem `export` z kluczem dopasowania z etapu 2, dziennik `sync_log` bez treści.

**Poza zakresem:** obrazy i dokumenty z eksportu (etap 4, kontrola na telefonie), scalanie „w miejscu” z aktualizacją treści wiadomości z powiadomień (etap 4, D5), eksport na klik z Androida, import z wielu grup jednym plikiem.

## Capabilities

### New Capabilities

- `chat-export-upload`: ręczny import tekstu eksportu czatu WhatsApp przez panel admina w PWA.

### Modified Capabilities

(brak)

## Impact

- PWA: zależność `fflate` (rozpakowanie ZIP w przeglądarce), nowa trasa `/admin/import`.
- API: nowy endpoint z limitem rozmiaru treści 15 MB, wymagane `SUPABASE_URL` (jak dla `/push/*`) i `PWA_ORIGIN` (CORS).
- Baza: bez migracji (`messages.source = 'export'` już istnieje).
