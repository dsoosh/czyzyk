# Proposal

## Why

Wstępna ocena (triaż) dostaje tylko tekst wiadomości, bez obrazów dokumentów. Wiadomość ze zdjęciem kalendarza dni wolnych ma pusty tekst, więc tani model uznał ją za nieistotną i pełna analiza się nie odbyła. Zdjęcie trafia na serwer tylko wtedy, gdy telefon albo użytkownik uznał je za dokument, więc zawsze powinno być przeanalizowane.

Poprawka, na zgłoszenie użytkownika. **Gotowe, gdy:** partia z nową wiadomością z dokumentem zawsze trafia do pełnej analizy, bez triażu.

## What Changes

- Worker: gdy któraś nowa wiadomość w partii ma dokument, triaż (reguły i tani model) jest pomijany i partia idzie do pełnej analizy.

**Poza zakresem:** dokumenty już pominięte przez triaż. Admin może je przeanalizować ponownie przyciskiem „Analizuj ponownie”.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `message-triage`: wiadomości z dokumentami nie przechodzą triażu.

## Impact

- Worker: `extraction/run.ts`, test `run.db.test.ts`.
