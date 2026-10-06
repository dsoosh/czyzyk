# Proposal

## Why

Ekstrakcja rusza dopiero po 30 minutach ciszy w grupie, więc wydarzenie lub płatność pojawia się w aplikacji nawet pół godziny po wiadomości. Rodzina chce widzieć skutki wiadomości od razu po tym, jak telefon ją przekaże (albo po imporcie eksportu czatu).

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** wiadomość „W piątek bal, przebrania” przyjęta z telefonu albo z importu pojawia się w PWA jako wydarzenie w ciągu około minuty, a seria kilku wiadomości wysłanych w krótkim odstępie trafia do modelu razem.

## What Changes

- Baza: trigger na `messages` wysyła `pg_notify('message_ingested', group_id)` po zapisaniu nieprzetworzonej wiadomości (powiadomienie, import, przyszły eksport z telefonu). Treść wiadomości nie trafia do powiadomienia.
- Worker: stałe połączenie `LISTEN message_ingested`; po powiadomieniu kolejkuje `extract-group` dla grupy z krótkim opóźnieniem zbierającym serię (`EXTRACTION_DELAY_SECONDS`, domyślnie 15 s). Połączenie odnawia się samo po zerwaniu.
- Skan co minutę zostaje jako zabezpieczenie (np. po restarcie workera), z tym samym opóźnieniem zamiast 30-minutowego okna ciszy.
- **BREAKING (konfiguracja):** `EXTRACTION_DEBOUNCE_MINUTES` zastąpione przez `EXTRACTION_DELAY_SECONDS`.

**Poza zakresem:** zmiana promptu i modelu ekstrakcji, przetwarzanie pojedynczych wiadomości poza kolejką.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `item-extraction`: moment ekstrakcji – zaraz po przyjęciu wiadomości zamiast po oknie ciszy.

## Impact

- Migracja `0009_realtime_extraction.sql` (funkcja i trigger).
- `services/worker`: nasłuch, konfiguracja, README, `.env.example`; `.railway/railway.ts`.
- Koszt: więcej wywołań modelu (każda seria osobno, każde z kontekstem ok. 50 wiadomości). Przy kilkudziesięciu wiadomościach dziennie to nadal grosze przy modelu z rodziny Haiku.
- `DATABASE_URL` workera musi być połączeniem bezpośrednim (sesyjnym) – już jest wymagane przez pg-boss.
- Archiwizacja dopiero po `etap-2-pierwszy-przeplyw-danych`: zmiana modyfikuje wymaganie `item-extraction` z tego etapu.
