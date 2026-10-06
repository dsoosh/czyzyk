# Design

## Context

`messages` i `wa_groups` mają politykę `family_read` (etap 1), a PWA czyta dane bezpośrednio z Supabase. Widok „skąd to wiem” pokazuje już wiadomości w kontekście przez RPC `message_context`.

## Decisions

### D1. Zapytania PostgREST zamiast nowego RPC
Lista: `wa_groups` z `tracked = true` plus ostatnia wiadomość każdej grupy (osobne zapytanie `limit 1` na grupę – grup jest kilka). Historia: `messages` grupy `order(sent_at desc).limit(n)`; „Wcześniejsze wiadomości” zwiększa `n` o 50 (ten sam wzorzec co w „skąd to wiem”), więc nowa wiadomość na górze nie przesuwa okna. Indeks `(group_id, sent_at desc)` obsługuje oba zapytania.

### D2. Wyszukiwanie `ilike`
Proste `ilike '%fraza%'` po `text` w obrębie grupy (znaki `%`, `_` i `\` z frazy są escapowane). Dla rodzinnej skali danych wystarczające; wyszukiwanie semantyczne przyjdzie z etapem 5.

### D3. Kolejność wyświetlania
Najstarsze u góry, najnowsze na dole (jak w komunikatorze), z separatorem dnia („dziś”, „wczoraj”, data) w strefie Europe/Warsaw.

## Risks / Trade-offs

- Treść wiadomości to niezaufane dane → wyświetlana wyłącznie jako tekst (React escapuje), bez renderowania linków ani HTML.
