# Proposal

## Why

Płatność da się oznaczyć jako zapłaconą tylko w zakładce Listy → Płatności. Na ekranie „Dziś”, gdzie rodzina najczęściej widzi płatności z bliskim terminem, nie ma tej opcji.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** płatność na ekranie „Dziś” można oznaczyć jako zapłaconą jednym stuknięciem.

## What Changes

- Ekran „Dziś”: pole „zapłacone” przy każdej płatności (ta sama funkcja `mark_paid` co na liście płatności). Zapłacona płatność znika z „Dziś”. Widać ją w Listy → Płatności → Zapłacone, gdzie można cofnąć oznaczenie.

**Poza zakresem:** zmiany na liście płatności.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `item-tracking`: oznaczanie zapłaty także na ekranie „Dziś”.

## Impact

- PWA: `TodayPage` i jego test.
