# Design

## Context

Stan po etapie 4: kompletna historia wiadomości z podpisami zdjęć. Kolumna `embedding` istnieje od etapu 1, nieużywana. Motywacja: `proposal.md`. Wymagania: `specs/*`.

## Goals / Non-Goals

**Goals:**
- Odpowiedź z pierwszym tokenem w < 3 s dla typowego pytania.
- Wyszukiwanie dostępne zarówno dla chatbota (serwer), jak i potencjalnie PWA (RLS).

**Non-Goals:**
- Reranking modelem – dopiero jeśli jakość okaże się niewystarczająca.

## Decisions

### D1. Embeddingi
Voyage `EMBEDDING_MODEL` (domyślnie model wielojęzyczny 1024-wymiarowy), `input_type = document` dla wiadomości i `query` dla pytań. Zadanie `embed-messages` co minutę bierze do 128 wiadomości bez embeddingu; backfill tym samym zadaniem. Indeks HNSW (`vector_cosine_ops`).
- *Alternatywa:* embeddingi Postgres-side (pgml) – niedostępne w Supabase.

### D2. Wyszukiwanie hybrydowe
Funkcja SQL `search_messages(query_text, query_embedding, limit)` (`security invoker`, więc RLS obowiązuje): dwie listy top-50 (cosinus i `similarity()` z `pg_trgm` na znormalizowanej treści) połączone Reciprocal Rank Fusion (k = 60). Podpisy zdjęć przez połączenie z `attachments.caption`.
- *Alternatywa:* pełnotekstowe `tsvector` – słaba obsługa polskiej odmiany bez słownika; trigramy są odporne na odmianę i literówki.

### D3. Pętla narzędzi
`services/api` prowadzi ręczną pętlę tool use na `messages.stream` (`CHAT_MODEL`, domyślnie Claude Sonnet) z narzędziami `search_messages`, `list_events`, `list_bring_items`, `list_payments`, `get_facts`, `get_album`; wszystkie wykonywane zapytaniami z uprawnieniami użytkownika (JWT przekazany do klienta Supabase), więc RLS ogranicza także chatbota. Wyniki narzędzi zawierają aliasy wiadomości (`W12`); model cytuje aliasy w znacznikach `[W12]`, które serwer zamienia na odnośniki i zapisuje w `cited_message_ids`. Prompt systemowy stały i cache'owany; treści wiadomości w wynikach narzędzi otoczone znacznikami danych.
- *Alternatywa:* czysty RAG (wyszukaj → wklej) – nie odpowie na „ile mam zapłacić w tym miesiącu”, które wymaga danych strukturalnych.

### D4. SSE i zapis
Zdarzenia SSE: `delta`, `citation`, `done`, `error`. Wiadomość asystenta zapisywana na bieżąco (co ~1 s) – przerwanie zostawia część z flagą `interrupted`. Limit: N pytań/dzień/użytkownik (`CHAT_DAILY_LIMIT`) liczony w bazie.

### D5. Ściągawka
Kolumna `facts.manual bool`; RPC `upsert_fact`, `delete_fact` dla rodziny ustawiają `manual = true`. Worker przy `update` faktu ręcznego zachowuje się jak przy decyzji admina z etapu 3 (propozycja do kolejki).

## Risks / Trade-offs

- [Model zmyśla mimo instrukcji] → wymóg cytatu: odpowiedź bez `[W…]` przy pytaniu o fakty dostaje dopisek „brak źródła”; testy na zestawie pytań.
- [Koszt Sonnet] → limit dzienny, cache promptu systemowego.

## Migration Plan

Migracja `0007_search.sql` (indeksy, funkcja, kolumny), uruchomienie backfillu przed włączeniem zakładki w PWA.
