# Proposal

## Why

Rodzina pakuje się rano, a wieczorny skrót mówi tylko o jutrze. Terminy płatności i zgód łatwo przegapić – alert „płatność na jutro” przychodzi tylko raz, gdy sprawa powstaje.

## What Changes

- `services/worker`: o porannej godzinie użytkownika (domyślnie 6:45, Europe/Warsaw):
  - poranny skrót „Dziś: …” – dzień wolny, wydarzenia z godziną, rzeczy do spakowania (bez spakowanych);
  - osobne przypomnienie o terminach – otwarte płatności i sprawy „wymaga odpowiedzi” z terminem dziś lub jutro („Termin dziś: … Termin jutro: …”).
  Każde najwyżej raz dziennie; pusty dzień nie wysyła nic.
- Baza: `push_settings` – `morning_enabled`, `morning_time`, `reminders_enabled` (domyślnie włączone) i znaczniki wysłania.
- API `PUT /push/settings`: nowe pola opcjonalne (starsza PWA ich nie zmienia).
- PWA: Ustawienia → Powiadomienia – poranny skrót z godziną i przypomnienia o terminach.

## Capabilities

### New Capabilities

- `morning-push`: poranny skrót i przypomnienia o terminach.

### Modified Capabilities

(brak)

## Impact

- Migracja `0022_morning_push.sql`; worker `push/digest.ts`, `push/cron.ts`; API `push/routes.ts`; PWA `PushSettingsSection`.
