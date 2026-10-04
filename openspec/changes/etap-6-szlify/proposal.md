# Proposal

## Why

Po etapie 5 system ma wszystkie funkcje, ale trzy słabości z sekcji „Ryzyka” pozostają bez zabezpieczenia: rodzina nie wie, że dane się zestarzały (telefon jedynym źródłem), nie widać awarii czytnika i eksportu, a wiadomości usunięte z grupy wciąż napędzają elementy.

Etap 6 z `docs/specyfikacja.md` („Szlify”). **Gotowe, gdy:** po 24 godzinach bez danych wszyscy widzą baner o nieaktualnych informacjach; wiadomość usunięta z grupy przenosi swoje elementy do przeglądu.

## What Changes

- Zdrowie synchronizacji: status „ostatnia synchronizacja X godzin temu” w panelu admina, dziennik błędów synchronizacji, baner nieaktualnych danych dla wszystkich po 24 h, alerty push dla admina o awarii eksportu i milczącym urządzeniu.
- Obsługa usuniętych wiadomości: wiadomość z powiadomienia nieobecna w eksporcie obejmującym jej czas dostaje `deleted_suspected`, a jej elementy – `needs_review`.

**Poza zakresem:** automatyczne przywracanie wiadomości. Album roku i pobieranie do fotoksiążki ze specyfikacji źródłowej odpadają – zdjęcia z zajęć nie opuszczają telefonu (decyzja z 2026-10-04 w `docs/specyfikacja.md`).

## Capabilities

### New Capabilities

- `sync-health`: widoczność stanu i awarii przepływu danych z telefonu dla admina i rodziny.

### Modified Capabilities

- `export-import`: dochodzi wykrywanie wiadomości usuniętych z grupy (nowe wymaganie).

## Impact

- Baza: widok stanu synchronizacji, kolumny `deleted_detected_at`.
- `services/worker`: krok wykrywania usuniętych wiadomości w imporcie.
- `services/cron`: sprawdzanie świeżości danych i alerty dla admina.
- `apps/pwa`: baner, ekran „Synchronizacja” w panelu admina.
