# Design

## Context

Eksport czatu WhatsApp to ZIP z `_chat.txt` (lub `WhatsApp Chat with X.txt`) i plikami multimediów, albo sam `.txt` przy eksporcie bez multimediów. Niezmiennik: zdjęcia są analizowane tylko na telefonie. Wymagania: `specs/chat-export-upload`.

## Decisions

### D1. ZIP rozpakowywany w przeglądarce, na serwer tylko tekst
`fflate` (`unzip` z filtrem) czyta z ZIP-a wyłącznie wpis `.txt` czatu; pozostałe wpisy nie są dekompresowane. API przyjmuje JSON `{ group_id, text, extract_days }`.
- *Alternatywa:* wysłać ZIP na serwer i tam odrzucić media – zdjęcia dzieci opuściłyby urządzenie, wbrew niezmiennikowi.

### D2. Parser we wspólnym pakiecie, parsowanie na serwerze
`packages/shared/src/chatExport.ts` (czysty TypeScript, bez zależności Node) – PWA używa go do podglądu, API do zapisu; ten sam parser posłuży etapowi 4. Format daty (dzień/miesiąc) wykrywany z całego pliku: pierwsza liczba > 12 → dzień pierwszy, druga > 12 → miesiąc pierwszy, domyślnie dzień pierwszy. Czas lokalny Europe/Warsaw → UTC przez `Intl` (obsługa zmiany czasu).
- *Alternatywa:* parsowanie tylko w PWA i wysyłanie gotowych wiadomości – serwer musiałby ufać strukturze od klienta; tekst jest prostszy do walidacji.

### D3. Duplikaty i źródło
Klucz dopasowania z etapu 2 (`dedupeKey`: grupa, autor, minuta, hash treści); `insert … on conflict do nothing`. Brak aktualizacji w miejscu (to zakres etapu 4, D5).
- *Alternatywa:* aktualizacja treści i źródła istniejącej wiadomości – zmienia dane, na których oparto już elementy; odłożona do etapu 4.

### D4. Ekstrakcja
Nowe wiadomości z okresu ekstrakcji: `processed_at = null`, `received_at = now() - 1 dzień`, więc skan workera (co minutę) od razu uznaje grupę za „po oknie ciszy”. Starsze: `processed_at = now()`. Worker przetwarza paczkami (limit wiadomości na przebieg), więc duży import rozkłada się na kolejne przebiegi.
- *Alternatywa:* kolejka pg-boss z API – API nie korzysta dziś z pg-boss; skan wystarcza.

### D5. Uprawnienia i limity
Weryfikacja sesji jak w `/push/*` (JWKS Supabase), dodatkowo `profiles.role = 'admin'`. Limit treści 15 MB, maks. 50 000 wiadomości w pliku; zapis w jednej transakcji partiami po 1000.

## Risks / Trade-offs

- [Nowe formaty eksportu WhatsAppa] → plik bez rozpoznanych wiadomości daje czytelny błąd zamiast cichego importu zera wiadomości.
- [Koszt ekstrakcji przy dużym imporcie] → domyślny okres 30 dni; starsze tylko jako historia.
