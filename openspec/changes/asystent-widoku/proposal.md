# Proposal

## Why

Rodzina ogląda kalendarz, listy, wydarzenia i historię czatów, ale pytania typu „co trzeba przygotować na ten tydzień?”, „o której jest pasowanie?” albo „co ustalono w Motylkach o wycieczce?” wymagają przeklikania kilku ekranów. Okienko z pytaniami do modelu, który widzi dane bieżącego widoku, odpowiada na nie od razu.

Zmiana poza kolejnością etapów, na prośbę użytkownika. Wyprzedza część etapu 5 (`family-assistant`): bez wyszukiwania w całej historii i bez zapisu wątków – model dostaje tylko dane widoku, na którym zadano pytanie. **Gotowe, gdy:** na każdym ekranie rodziny jest przycisk „Zapytaj”, a pytanie zadane np. w kalendarzu października albo w historii grupy dostaje po polsku odpowiedź opartą na danych tego widoku, a przy braku informacji – wprost „nie wiem”.

## What Changes

- `services/api`: `POST /assistant/ask` – sesja Supabase członka rodziny, opis widoku (dziś, kalendarz miesiąca, wydarzenie, lista, historia grupy, „skąd to wiem”), pytanie i do 10 poprzednich wymian. Serwer sam pobiera dane widoku z bazy (klient nie przesyła danych), składa prompt i pyta model `CHAT_MODEL`. Bez narzędzi – model niczego nie zmienia.
- Limity: na minutę i na dzień na osobę (`ASSISTANT_DAILY_LIMIT`).
- PWA: pływający przycisk „Zapytaj” na ekranach rodziny, panel z rozmową (pytania, odpowiedzi, „Nowa rozmowa”), kontekst = bieżący widok.
- Logi i `sync_log`: bez treści pytań, odpowiedzi i wiadomości (tylko rodzaj widoku, liczby tokenów, status).

**Poza zakresem:** zapis wątków w bazie (`chat_threads`), wyszukiwanie w całej historii i embeddingi (etap 5), strumieniowanie odpowiedzi, cytaty z odnośnikami, panel admina.

## Capabilities

### New Capabilities

- `view-assistant`: pytania do modelu językowego o dane bieżącego widoku PWA.

### Modified Capabilities

(brak)

## Impact

- `services/api`: zależność `@anthropic-ai/sdk`, zmienne `ANTHROPIC_API_KEY`, `CHAT_MODEL` (bez nich endpoint odpowiada 503), `ASSISTANT_DAILY_LIMIT`; `.railway/railway.ts`.
- `packages/shared`: schemat żądania (`assistantAskSchema`) wspólny dla API i PWA.
- `apps/pwa`: komponent `AssistantPanel` w układzie strony.
- Koszt: jedno wywołanie modelu na pytanie; kontekst do ok. 200 wiadomości lub kilkudziesięciu elementów.
