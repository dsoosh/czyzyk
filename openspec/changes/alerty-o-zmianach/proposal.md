# Proposal

## Why

Natychmiastowe alerty push obejmują dziś tylko dzień wolny, nową sprawę „wymaga odpowiedzi” i płatność na jutro. O nowym albo zmienionym wydarzeniu i o nowej rzeczy do przyniesienia rodzina dowiaduje się dopiero z wieczornego skrótu albo po otwarciu aplikacji. Użytkownik chce dostawać powiadomienie na telefon od razu po tym, jak wydarzenie powstanie lub się zmieni, pojawi się coś nowego do przyniesienia albo sprawa do decyzji.

Zmiana na prośbę użytkownika. **Gotowe, gdy:**
- nowe, zmienione i odwołane wydarzenie wywołuje alert od razu po analizie;
- nowa rzecz do przyniesienia wywołuje alert;
- sprawa do decyzji nadal wywołuje alert, tak jak dziś;
- każdy z nowych rodzajów można wyłączyć w ustawieniach.

## What Changes

- **Baza:** `0042_change_alerts.sql`:
  - `push_settings.alert_events` i `alert_bring_items` (domyślnie włączone);
  - `push_alerts_sent` dostaje rodzaje `event_new`, `event_changed`, `bring_item_new` oraz kolumnę `ref`;
  - zmienione wydarzenie alarmuje raz na każdą zapisaną zmianę (`item_changes.id`).
- **Analiza:** wynik zawiera przy każdym elemencie, co się stało (`created`, `updated`, `cancelled`, `touched`) i identyfikator zapisanej zmiany. „touched” to aktualizacja bez zmiany pól, która nie wywołuje alertu o wydarzeniu.
- **Worker:** zadania `push-alert` dla wydarzeń i rzeczy do przyniesienia. Treść:
  - „Nowe wydarzenie: Wycieczka (15.10 8:30)”;
  - „Zmiana w wydarzeniu: … (termin, miejsce)”;
  - „Odwołane: …”;
  - „Do przyniesienia: strój (na 10.10)”.

  Odbiorcy jak przy innych alertach: rodziny widzące element, z włączonym rodzajem alertu. Bez alertu zostają:
  - stałe zajęcia w godzinach przedszkola;
  - minione wydarzenia i rzeczy;
  - dołączenie do wspólnego wydarzenia.
- **API i PWA:** dwa nowe przełączniki w ustawieniach powiadomień.

## Capabilities

### New Capabilities

- `change-alerts`: natychmiastowe alerty o wydarzeniach i rzeczach do przyniesienia.
