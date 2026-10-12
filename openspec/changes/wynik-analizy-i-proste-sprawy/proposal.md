# Proposal

## Why

Trzy zgłoszenia użytkownika:
- Po błędzie 400 i ponownej analizie panel LLM pokazywał, że model dopisał dziecko z innej grupy do istniejącego wydarzenia (`join`), ale w aplikacji dziecko się nie pojawiło. Przyczyny:
  - przy starych sprawach (`legacy_audience`) baza po każdej analizie liczyła adresatów od nowa z treści wiadomości i nadpisywała imiona dopisane przez `join` i `update`;
  - sprawy całej grupy trzymały stare przypisanie do dziecka operatora, więc pokazywały tylko jego;
  - PWA pokazywała dzieci tylko z głównej grupy sprawy, bez grup dołączonych przez `join`, a widoki `family_*` nie miały kolumn dodanych po ich utworzeniu.
- W panelu LLM brakuje sposobu na przekazanie całego wywołania do analizy oraz informacji, co z odpowiedzi modelu faktycznie zapisano.
- W „Wymaga odpowiedzi” dynamiczne akcje mają zostać zastąpione jednym przyciskiem „Oznacz jako wykonane”.

Zmiana na prośbę użytkownika. **Gotowe, gdy:**
- dziecko dopisane przez analizę zostaje przy sprawie;
- panel LLM pokazuje wynik zapisu i kopiuje całość;
- sprawy „wymaga odpowiedzi” mają tylko „Oznacz jako wykonane”.

## What Changes

- **Adresaci z analizy wygrywają:** `join` i `update` z imionami wyłączają `legacy_audience`, więc przeliczenie z treści wiadomości ich nie nadpisuje.
- **Sprawy całej grupy:** `refresh_item_children()` czyści `child_ids` spraw bez adresatów.
- **Widoki rodziny:** `family_bring_items`, `family_payments` i `family_action_required` są odtworzone z kolumnami `audience`, `extra_group_ids` i `legacy_audience`.
- **PWA, dzieci przy sprawie:** pokazuje dzieci głównej grupy i grup dołączonych.
- **Dziennik LLM:**
  - nowa kolumna `llm_calls.outcome` z liczbą utworzonych, zmienionych, odwołanych i oddanych do przeglądu spraw oraz z odrzuconymi operacjami i ich powodem;
  - w panelu sekcja „Zapisano” i przycisk „Kopiuj całość”, który kopiuje zapytanie, odpowiedź, wynik zapisu, prompt systemowy i błąd.
- **„Wymaga odpowiedzi”:**
  - na „Dziś” i liście zamiast proponowanych akcji jest tylko przycisk „Oznacz jako wykonane”;
  - prompt analizy nie prosi o `suggestions` (także stała część), a kontekst analizy ich nie zawiera.

**Poza zakresem:** usunięcie kolumny `suggested_actions` i RPC `apply_action_suggestion` (zostają nieużywane).

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `families`: adresaci z analizy przy starych sprawach, dzieci grup dołączonych, „Wymaga odpowiedzi” bez akcji.
- `llm-call-log`: wynik zapisu i kopiowanie wywołania.

## Impact

- Baza: migracja `0038_llm_call_outcome.sql`; testy `legacy-item-audience.test.ts`, `run.db.test.ts`.
- Worker:
  - `extraction/apply.ts`;
  - `extraction/run.ts`;
  - `extraction/llmLog.ts`;
  - `extraction/batch.ts`.
- Shared: `prompts.ts`.
- PWA:
  - `LlmCallsPage`;
  - `ResolveButton`;
  - `TodayPage`;
  - `ActionsPage`;
  - `lib/children.ts`;
  - `lib/items.ts`.

  Usunięte: `ActionSuggestions`, `lib/actions.ts`.
