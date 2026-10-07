# Proposal

## Why

Na ekranie wydarzenia widać tylko jego bieżący stan i link „skąd to wiem”, który pokazuje rozmowę wokół jednej wiadomości. Rodzina chce po kliknięciu w wydarzenie od razu widzieć całą historię: wszystkie wiadomości o tym wydarzeniu, zdjęcia dokumentów (plakaty, ogłoszenia) i każdą zmianę, np. przesunięcie godziny.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** ekran wydarzenia pokazuje w jednej osi czasu wiadomości, zdjęcia dokumentów i zmiany wydarzenia oraz jego rzeczy do przyniesienia.

## What Changes

- Ekran wydarzenia: sekcja „Historia”, od najstarszych:
  - wiadomości źródłowe wydarzenia, jego rzeczy do przyniesienia i wszystkich ich zmian;
  - dokumenty z tych wiadomości: zdjęcie (po kontroli serwera) albo opis i tekst odczytany na telefonie;
  - zmiany (utworzenie, zmiana pól przed → po, odwołanie) z uzasadnieniem.
- Migracja `0025_event_history`: funkcja `attachment_image` wydaje członkowi rodziny jeden sprawdzony obraz dokumentu. Tabela `attachment_files` pozostaje bez bezpośredniego dostępu.
- Wspólne formatowanie zmian (`lib/changes.ts`) dla „skąd to wiem” i historii wydarzenia.

**Poza zakresem:** zdjęcia, które nie są dokumentami (zdjęcia ludzi nigdy nie trafiają na serwer), historia innych rodzajów spraw na ich ekranach.

## Capabilities

### New Capabilities

- `event-history`: pełna historia wydarzenia na jego ekranie.

### Modified Capabilities

(brak)

## Impact

- Baza: migracja `0025_event_history` (funkcja `security definer` z `is_family`, bez nowych tabel).
- PWA: `EventPage`, `components/EventHistory.tsx`, `lib/items.ts`, `lib/changes.ts`, `SourcePage`.
