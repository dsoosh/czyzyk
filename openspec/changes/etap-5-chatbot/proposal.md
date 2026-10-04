# Proposal

## Why

Wiele pytań rodziców nie dotyczy wyciągniętych elementów, tylko historii rozmów („co pisali o wycieczce?”, „jak ma na imię pani od angielskiego?”). Przewijanie czatu WhatsApp jest uciążliwe, a historia jest już w bazie. Chatbot z dostępem do wyszukiwania i danych aplikacji odpowiada na te pytania ze wskazaniem źródeł, a ściągawka zbiera stałe informacje w jednym miejscu.

Etap 5 z `docs/specyfikacja.md` („Chatbot”). **Gotowe, gdy:** pytanie „kiedy jest pasowanie?” lub „co pisali o wycieczce?” dostaje w zakładce „Zapytaj” odpowiedź z odnośnikami do wiadomości źródłowych, a pytanie bez odpowiedzi w historii – wprost „nie wiem”; ściągawka pokazuje godziny, nauczycielki i kontakty.

## What Changes

- Embeddingi wiadomości i podpisów zdjęć (Voyage AI, model wielojęzyczny) w pgvector, uzupełnianie wsteczne dla istniejącej historii.
- Wyszukiwanie hybrydowe: wektory + `pg_trgm`, z połączeniem wyników.
- Zakładka „Zapytaj”: Claude Sonnet z narzędziami tylko do odczytu, odpowiedzi strumieniowane (SSE) z cytatami, wątki per użytkownik, limit zapytań.
- Ekran „Ściągawka”: fakty z ekstrakcji, edycja ręczna (RPC), ochrona ręcznych zmian przed nadpisaniem.

**Poza zakresem:** odpowiedzi głosowe, chatbot wykonujący akcje (oznaczanie, zmiany danych), wyszukiwanie w treści dokumentów PDF poza podpisem i ekstrakcją.

## Capabilities

### New Capabilities

- `message-search`: indeks i wyszukiwanie hybrydowe po historii wiadomości i podpisach zdjęć.
- `family-assistant`: chatbot odpowiadający na pytania o przedszkole na podstawie danych aplikacji, z cytatami.
- `cheat-sheet`: ściągawka stałych informacji (godziny, osoby, kontakty) – automatyczna i edytowalna.

### Modified Capabilities

(brak – `item-extraction` już tworzy fakty; ściągawka je prezentuje)

## Impact

- Baza: kolumna `embedding vector(1024)` (już w schemacie), indeks HNSW, indeks trigramowy, funkcja `search_messages`, RPC wątków i edycji faktów.
- `services/worker`: zadanie `embed-messages`, zależność od Voyage (`VOYAGE_API_KEY`, `EMBEDDING_MODEL`).
- `services/api`: `POST /chat/threads/{id}/messages` (SSE), uwierzytelnienie sesją Supabase, limit zapytań; `CHAT_MODEL` (domyślnie Claude Sonnet).
- `apps/pwa`: zakładki „Zapytaj” i „Ściągawka”.
