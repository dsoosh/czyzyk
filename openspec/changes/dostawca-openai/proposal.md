# Proposal

## Why

Rodzina rozważa przejście na tańsze modele OpenAI – analiza wiadomości nie wymaga najwyższej precyzji. Zmiana dostawcy ma być kwestią konfiguracji, bez zmian w kodzie przy przełączeniu.

## What Changes

- `packages/shared`: klient OpenAI Chat Completions na `fetch` (bez nowej zależności): wymuszone wywołanie narzędzia, obrazy w ostatniej turze, ponawianie 408/409/429/5xx, odmowa, zużycie tokenów.
- `services/worker`: gdy ustawione są `OPENAI_API_KEY` i `OPENAI_EXTRACTION_MODEL`, analiza, triaż (`OPENAI_TRIAGE_MODEL`, opcjonalnie) i kontrola zdjęć (`OPENAI_DOCUMENT_MODEL`, domyślnie model analizy) idą do OpenAI; w przeciwnym razie – jak dotąd do Anthropic. `ANTHROPIC_API_KEY` i `EXTRACTION_MODEL` są wymagane tylko bez OpenAI.
- `services/api`: asystent „Zapytaj” – OpenAI przy `OPENAI_API_KEY` i `OPENAI_CHAT_MODEL`, w przeciwnym razie Claude.
- Te same narzędzia, walidacja, dziennik LLM admina i zasady bezpieczeństwa niezależnie od dostawcy. Nazwy modeli tylko w konfiguracji.

## Capabilities

### New Capabilities

- `llm-provider`: wybór dostawcy modeli z konfiguracji.

### Modified Capabilities

(brak)

## Impact

- `.railway/railway.ts`: zmienne `OPENAI_*` jako `preserve()` (ustawiane w panelu Railway); `docs/wdrozenie.md`.
