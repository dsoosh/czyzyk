# Proposal

## Why

Zmiana `wydarzenia-kilkudniowe` scala sąsiednie dni wolne tylko w widoku kalendarza. W bazie zostają osobne wpisy na każdy dzień. Widzą je skróty, alerty, asystent i subskrypcja kalendarza. Analiza dostaje je jako osobne elementy. Użytkownik chce, żeby istniejące sąsiednie dni wolne zostały w danych połączone w jeden zakres.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** po migracji sąsiednie aktywne dni wolne tej samej grupy i o tym samym powodzie są w bazie jednym dniem wolnym od–do.

## What Changes

- Migracja `0029_merge_closures`, jednorazowa. Łączy aktywne dni wolne tej samej grupy (albo całego przedszkola) o tym samym powodzie, porównywanym bez wielkości liter i zbędnych spacji. Łączy je, gdy przypadają na kolejne dni albo dzieli je tylko weekend.
- Najwcześniejszy dzień wolny zostaje i dostaje późniejszą datę końca. Dostaje też wiadomości źródłowe pozostałych.
- Pozostałe dni wolne są odwołane (`cancelled`), a nie usunięte.
- Każda zmiana trafia do historii elementu z uzasadnieniem „Połączono sąsiednie dni wolne w jeden zakres.”

**Poza zakresem:**
- wydarzenia;
- łączenie nowych dni wolnych przy analizie (prompt już prosi o jeden zakres).

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `school-calendar`: istniejące sąsiednie dni wolne połączone w zakres.

## Impact

- Baza: migracja `0029_merge_closures.sql`, test `supabase/tests/closure-ranges.test.ts`.
