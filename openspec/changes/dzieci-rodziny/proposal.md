# Proposal

## Why

Rodzina ma kilkoro dzieci w różnych grupach, a wiadomości często dotyczą konkretnego dziecka („Zosia przynosi jutro kasztany”, „Antek zapomniał kapci”). Dziś elementy są przypisane tylko do grupy, więc nie widać, którego dziecka dotyczą, a model nie zna imion dzieci rodziny.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** w Ustawieniach można dodać dziecko (imię i grupa) przyciskiem „Dodaj dziecko”, ekstrakcja przypisuje elementy do dziecka wymienionego w wiadomości, a PWA pokazuje przy elementach imię dziecka (przypisanego wprost albo z grupy, z której pochodzi element).

## What Changes

- Baza: tabela `children` (imię, grupa), kolumna `child_ids` w wydarzeniach, rzeczach do przyniesienia, płatnościach i sprawach; RPC `save_child`, `delete_child` dla członków rodziny.
- Ekstrakcja: prompt zawiera listę dzieci z grupami; operacja może wskazać `children` (imiona z listy). Serwer zamienia imiona na identyfikatory, nieznane imiona pomija.
- PWA: sekcja **Dzieci** w Ustawieniach (lista, edycja imienia i grupy, „Dodaj dziecko”, usuwanie); imię dziecka przy elementach na ekranie Dziś i na Listach.
- Asystent „Zapytaj” widzi imiona dzieci przy elementach.

**Poza zakresem:** filtrowanie widoków po dziecku, osobne powiadomienia dla dziecka, przypisywanie dziecka ręcznie do pojedynczego elementu.

## Capabilities

### New Capabilities

- `family-children`: dzieci rodziny (imię, grupa) i przypisywanie do nich elementów.

### Modified Capabilities

(brak)

## Impact

- Migracja `0010_children.sql`.
- `packages/shared` (kontrakt ekstrakcji: pole `children` operacji), `services/worker` (prompt, wczytanie, zapis), `services/api` (kontekst asystenta), `apps/pwa` (Ustawienia, wiersze elementów).
