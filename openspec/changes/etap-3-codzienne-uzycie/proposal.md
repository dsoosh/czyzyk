# Proposal

## Why

Po etapie 2 rodzina widzi wyciągnięte elementy, ale nie może na nich działać: odhaczyć spakowanej rzeczy, oznaczyć płatności, zatwierdzić wątpliwego elementu ani dostać przypomnienia. Bez tego aplikacja jest tylko podglądem, a nie narzędziem codziennego użytku, a elementy o niskiej pewności giną niewidoczne.

Etap 3 z `docs/specyfikacja.md` („Codzienne użycie”). **Gotowe, gdy:** rodzina korzysta z checklisty, płatności i spraw na co dzień, dostaje wieczorny skrót push, ma wydarzenia w swoim kalendarzu przez iCal, a admin rozpatruje kolejkę `needs_review`.

## What Changes

- Ekrany „Do przyniesienia”, „Płatności”, „Wymaga odpowiedzi” i lista dni wolnych; odhaczanie z informacją kto i kiedy (wąskie RPC).
- Odhaczanie rzeczy na jutro bezpośrednio na ekranie „Dziś i jutro”.
- Kolejka `needs_review` w panelu admina: zatwierdź, popraw, odrzuć.
- Prywatny link subskrypcji iCal per użytkownik (`GET /ical/{token}.ics`), z unieważnianiem.
- Web Push (VAPID): wieczorny skrót o godzinie wybranej przez użytkownika, natychmiastowe alerty, onboarding iPhone'a.
- Nowa usługa `services/cron` (harmonogram skrótów i alertów, ponowienia).

**Poza zakresem:** eksport czatu i zdjęcia (etap 4), chatbot i ściągawka (etap 5), alerty o braku synchronizacji (etap 6), powiadomienia e-mail/SMS.

## Capabilities

### New Capabilities

- `item-tracking`: wspólne listy rzeczy do przyniesienia, płatności, spraw „wymaga odpowiedzi” i dni wolnych z oznaczaniem wykonania.
- `extraction-review`: ręczny przegląd elementów o niskiej pewności przez admina.
- `calendar-subscription`: prywatny feed iCal z wydarzeniami i dniami wolnymi.
- `push-notifications`: powiadomienia Web Push – wieczorny skrót i alerty natychmiastowe.

### Modified Capabilities

- `today-view`: dochodzi odhaczanie rzeczy do przyniesienia z ekranu głównego (nowe wymaganie, istniejące bez zmian).

## Impact

- Baza: RPC `mark_packed`, `mark_paid`, `mark_resolved`, `review_item`, `create_ical_token`, `revoke_ical_token`; kolumny ustawień użytkownika (godzina skrótu, rodzaje alertów).
- `services/api`: `/ical/{token}.ics`, `/push/subscribe`, `/push/unsubscribe`, `/push/test`.
- `services/cron`: nowa usługa Railway; zależność `web-push`; zmienne `VAPID_*`.
- `services/worker`: emisja zdarzeń „nowy dzień wolny”, „nowa sprawa”, „płatność na jutro” po zapisie operacji.
- `apps/pwa`: nowe ekrany, service worker obsługujący push, onboarding instalacji.
