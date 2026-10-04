# Worker

Przetwarzanie w tle (pg-boss na Postgresie Supabase). Na etapie 2: ekstrakcja elementów z wiadomości grup przez Claude.

## Jak działa ekstrakcja

1. Co minutę zadanie `extraction-scan` szuka grup, w których od przyjęcia ostatniej nieprzetworzonej wiadomości minęło `EXTRACTION_DEBOUNCE_MINUTES` (okno ciszy liczone od `received_at`, nie od czasu wysłania).
2. Dla każdej takiej grupy trafia do kolejki zadanie `extract-group` (jedno na grupę naraz, `singletonKey` + blokada doradcza).
3. Prompt dostaje nowe wiadomości, `EXTRACTION_CONTEXT_MESSAGES` wcześniejszych wiadomości i aktualne elementy z aliasami (`W1…`, `E1…`). Treść wiadomości jest oznaczona jako niezaufane dane.
4. Model odpowiada wywołaniem narzędzia `zapisz_operacje` (create / update / cancel). Odpowiedź jest walidowana schematem zod z `@czyzyk/shared`; operacje z nieznanymi aliasami lub niepoprawnymi danymi są odrzucane i trafiają do `sync_log`.
5. Operacje zapisywane są w jednej transakcji; pewność poniżej `EXTRACTION_CONFIDENCE_THRESHOLD` daje status `needs_review`. Wiadomości dostają `processed_at`.
6. Błąd modelu (np. 529) – SDK ponawia kilka razy, potem zadanie wraca do kolejki z rosnącym odstępem; wiadomości zostają nieprzetworzone.

Logi i `sync_log` zawierają tylko identyfikatory, liczby i kody błędów – nigdy treści wiadomości.

## Zmienne środowiskowe

Wszystkie w [`.env.example`](.env.example). Wymagane: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `EXTRACTION_MODEL`.

| Zmienna | Domyślnie | Znaczenie |
| --- | --- | --- |
| `EXTRACTION_MODEL` | – (wymagana) | model Claude do ekstrakcji; nazwy modeli tylko w konfiguracji |
| `EXTRACTION_DEBOUNCE_MINUTES` | 30 | okno ciszy w grupie przed ekstrakcją |
| `EXTRACTION_CONFIDENCE_THRESHOLD` | 0.7 | próg pewności, poniżej – `needs_review` |
| `EXTRACTION_CONTEXT_MESSAGES` | 50 | liczba wcześniejszych wiadomości w prompcie |

## Ewaluacja promptu

Zestaw 30 przykładowych wiadomości z oczekiwanym wynikiem: [`eval/cases.json`](eval/cases.json). Uruchamiaj przy każdej zmianie promptu lub modelu (koszt: ok. 30 wywołań modelu):

```bash
ANTHROPIC_API_KEY=… EXTRACTION_MODEL=claude-haiku-4-5 npm run eval:extraction -w @czyzyk/worker
npm run eval:extraction -w @czyzyk/worker -- --only bal-przebrania   # jeden przypadek
```

Raport pokazuje ✓/✗ dla każdego przypadku z listą rozbieżności oraz łączną zgodność. W CI ewaluacja nie uruchamia się automatycznie (zużywa płatne API).
