# Proposal

## Why

Powiadomienia włącza się dziś tylko w Ustawieniach → Powiadomienia. Kto tam nie zajrzy, nie dostaje skrótów ani alertów, choć wszystkie są domyślnie włączone. Przeglądarka nie pozwala włączyć powiadomień bez zgody użytkownika, więc najkrótsza droga to jedno stuknięcie w widocznym miejscu.

## What Changes

- PWA: baner „Włącz powiadomienia” nad treścią każdej strony (poza Ustawieniami), gdy na tym urządzeniu nie ma subskrypcji, a przeglądarka nie odmówiła zgody.
  - „Włącz” prosi o zgodę i rejestruje subskrypcję (ta sama ścieżka co w Ustawieniach).
  - „Nie teraz” chowa baner na 30 dni na tym urządzeniu.
  - iPhone poza ekranem początkowym: baner rozwija instrukcję „Udostępnij → Do ekranu początkowego”.
  - Brak banera, gdy przeglądarka nie obsługuje push (także w aplikacji Czyżyk Connect na Androidzie), gdy brak konfiguracji push albo gdy zgoda została odrzucona.

## Capabilities

### New Capabilities

- `push-prompt`: zachęta do włączenia powiadomień na urządzeniu.

### Modified Capabilities

(brak)

## Impact

- PWA: `lib/push.ts` (stan zgody, zapamiętanie „Nie teraz”), nowy `components/PushBanner.tsx`, `components/Layout.tsx`; instrukcja dla iPhone'a wydzielona z `PushSettingsSection`.
- Bez zmian w API, workerze i bazie.
