# Proposal

## Why

Historia grupy pokazuje od razu 50 wiadomości i trzeba długo przewijać do najnowszych. Użytkownik chce widzieć tylko ostatnie 20.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** historia grupy pokazuje 20 najnowszych wiadomości, a „Wcześniejsze wiadomości” doczytuje kolejne 20.

## What Changes

- PWA: porcja historii grupy (`HISTORY_PAGE`) 20 zamiast 50, także przy doczytywaniu i wyszukiwaniu.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `group-history`: porcje po 20 wiadomości.

## Impact

- PWA: `lib/history.ts`, test `Chats.test.tsx`.
