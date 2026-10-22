# Proposal

## Why

Analiza wiadomości i triaż działały na modelu z etapu 2 (Haiku 4.5). Ostatnio ten model pomijał plan dnia przy jasno podanych godzinach i zapisał listę dat jako zajęcia co tydzień. Spódnicę dla dziewczynek przypisał chłopcu. Użytkownik zdecydował o przejściu na Haiku 5.5 we wszystkich wywołaniach modelu.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** analiza, triaż, kontrola zdjęć dokumentów i „Zapytaj” korzystają z Haiku 5.5.

## What Changes

- **Konfiguracja Railway (`.railway/railway.ts`):**
  - `EXTRACTION_MODEL` i `TRIAGE_MODEL` w workerze: `claude-haiku-5-5`;
  - `DOCUMENT_MODEL` domyślnie bierze model analizy;
  - `CHAT_MODEL` w API: `claude-haiku-5-5`, zamiast Sonneta 5.5.
- **Przykłady konfiguracji:** `.env.example` i README workera.
- Kod się nie zmienia: nazwy modeli są wyłącznie w konfiguracji.

## Capabilities

### Modified Capabilities

- `llm-provider`: modele Claude w konfiguracji.
