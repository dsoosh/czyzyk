# Proposal

## Why

Gdy przedszkole zmienia godzinę lub termin wydarzenia, analiza aktualizuje istniejące wydarzenie, ale poprzednia wartość przepada, a „Skąd to wiem” pokazuje rozmowę tylko wokół pierwszej wiadomości. Użytkownik widzi pierwszy wpis i nie wie, skąd wzięła się nowa godzina.

## What Changes

- Baza: tabela `item_changes` – historia zmian spraw z analizy: utworzenie (dane), zmiana (pole: poprzednia → nowa wartość), odwołanie; z wiadomościami źródłowymi i uzasadnieniem. Odczyt dla rodziny, zapis tylko przez worker.
- `services/worker`: każde utworzenie, zmiana (z różnicą pól, także przypisania dzieci) i odwołanie zapisuje wpis w tej samej transakcji; aktualizacja bez zmiany wartości i uzupełnienie propozycji akcji nie zapisują nic.
- PWA, „Skąd to wiem”: sekcja „Historia zmian” (od najnowszej: co się zmieniło, uzasadnienie, cytat wiadomości); dla starszych spraw bez historii – lista wszystkich wiadomości źródłowych; rozmowa pokazywana wokół najnowszej wiadomości źródłowej zamiast pierwszej.

**Poza zakresem:** zmiany wprowadzone przez admina w przeglądzie i akcje rodziny (spakowane, zapłacone) – osobna zmiana, jeśli będzie potrzebna.

## Capabilities

### New Capabilities

- `item-history`: historia zmian spraw z analizy wiadomości, widoczna w „Skąd to wiem”.

### Modified Capabilities

(brak)

## Impact

- Migracja `0021_item_history.sql`; `services/worker/src/extraction/apply.ts`; PWA `SourcePage`, `lib/items.ts`.
