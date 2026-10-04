# Design

## Context

Stan po etapie 1: monorepo, pełny schemat z RLS, logowanie Google, szkielety `api`/`worker`/PWA i pusty projekt Android. Motywacja: `proposal.md`. Wymagania: `specs/*` tej zmiany. Zmiana przecina telefon, dwie usługi, bazę i PWA oraz wprowadza zewnętrzną zależność (Anthropic API).

## Goals / Non-Goals

**Goals:**
- Kryterium etapu (35 minut od wiadomości do PWA) spełnione z zapasem przy domyślnej konfiguracji.
- Jedno miejsce prawdy dla schematów wymienianych między usługami (`packages/shared`).
- Ekstrakcja testowalna offline (atrapa klienta modelu) i ewaluowalna online (zestaw 30 przykładów).

**Non-Goals:**
- Interakcje na elementach (odhaczanie) i panel przeglądu – etap 3.
- Pobieranie treści załączników – etap 4 (tu tylko flaga i licznik).

## Decisions

### D1. Kontrakt ingestu
`POST /ingest/notification` z nagłówkiem `Authorization: Bearer <token urządzenia>` i ciałem `{idempotency_key (uuid), group_name, author, text, sent_at (ISO 8601 z offsetem), has_attachment, wa_package}`; schemat zod w `packages/shared`. `GET /ingest/config` zwraca `{tracked_groups: string[], config_ttl_seconds: 900}`. `POST /ingest/seen-groups` przyjmuje `{names: string[]}`. Odpowiedzi: 201 nowa, 200 duplikat (idempotencja lub klucz dopasowania), 400, 401, 422 (grupa nieśledzona), 429.
- *Alternatywa:* paczki wielu wiadomości w jednym żądaniu – mniej żądań, ale komplikuje idempotencję per wiadomość; ruch jest mały (dziesiątki wiadomości dziennie).

### D2. Tokeny urządzeń
RPC `admin_create_device(name)` generuje 32 bajty z `gen_random_bytes`, zapisuje `sha256` (hex) i zwraca token raz; `admin_revoke_device(id)` ustawia `revoked_at`. API liczy `sha256` z nagłówka i szuka aktywnego urządzenia (porównanie hashy w bazie, indeks unikalny), aktualizuje `last_seen_at` nie częściej niż raz na minutę. Kod QR zawiera `czyzyk://pair?server=<url>&token=<token>`.
- *Alternatywa:* JWT podpisany przez serwer – nie da się go unieważnić bez listy odwołań, czyli i tak potrzebna tabela.

### D3. Klucz dopasowania
`dedupe_key = sha256(group_id | normalize(author) | floor_minute(sent_at UTC) | sha256(normalize(text)))`, gdzie `normalize` = NFC, małe litery, białe znaki zwinięte do spacji, przycięte. Funkcja w `packages/shared` (etap 4 użyje jej w parserze eksportu). Unikalne indeksy: `(group_id, dedupe_key)` i `idempotency_key`. Wstawienie `on conflict do nothing` + odczyt istniejącego wiersza.
- *Alternatywa:* hash bez autora – mniejsza wrażliwość na różnice nazw kontaktów, ale łączyłby identyczne „Dziękuję” różnych osób.

### D4. Debounce na kolumnie `received_at` + cykliczne zadanie
Worker co minutę (harmonogram pg-boss) wybiera grupy z nieprzetworzonymi wiadomościami, w których `max(received_at) < now() - debounce`, i wysyła zadanie `extract-group` z `singletonKey = group_id`. Używamy czasu przyjęcia, nie `sent_at`, bo telefon offline może dosłać stare wiadomości. Zadanie bierze blokadę doradczą na grupę, więc równoległe zadania dla jednej grupy są niemożliwe.
- *Alternatywa:* zadanie opóźnione o 30 minut planowane przy każdej wiadomości i anulowane przy następnej – pg-boss nie przesuwa terminu zadania singleton, więc wymagałoby to ręcznego zarządzania; skanowanie co minutę jest proste i samonaprawiające (restart workera niczego nie gubi).

### D5. Wywołanie modelu
`@anthropic-ai/sdk`, `messages.create` z jednym narzędziem `zapisz_operacje` (schemat JSON generowany z zod przez `z.toJSONSchema`) i `tool_choice: auto` plus instrukcja w prompcie, by zawsze wywołać narzędzie (forced tool choice nie jest dostępny na części nowszych modeli, a model jest konfigurowalny). Brak wywołania narzędzia lub błąd walidacji = błąd próby (ponowienie). Model z `EXTRACTION_MODEL` (domyślnie `claude-haiku-4-5`), `max_tokens` 16000. Prompt systemowy jest stały (cache'owalny), zmienna część w wiadomości użytkownika: dzisiejsza data i dzień tygodnia w Europe/Warsaw, nazwa grupy, ~50 wiadomości kontekstu, nowe wiadomości, aktualne przyszłe elementy. Treść wiadomości otoczona znacznikami `<wiadomosci>` z instrukcją, że to dane.
- *Alternatywa:* structured outputs (`output_config.format`) – także dobre; tool use zostaje, bo specyfikacja go wymaga i ten sam schemat posłuży triażowi zdjęć w etapie 4.

### D6. Krótkie aliasy identyfikatorów w prompcie
Wiadomości i elementy dostają w prompcie aliasy `W1…Wn` i `E1…En`; model posługuje się aliasami, a serwer mapuje je na UUID. Alias spoza mapy = odrzucenie operacji (wymaganie o nieznanych identyfikatorach). Operacja `create` może nadać lokalne `ref` (np. `nowe1`), aby rzecz do przyniesienia wskazała wydarzenie tworzone w tej samej odpowiedzi.
- *Alternatywa:* pełne UUID – drożej w tokenach i model częściej je przekręca.

### D7. Zapis operacji
Jedna transakcja na zadanie: zastosowanie operacji, ustawienie `processed_at` na wiadomościach z partii, wpis w `sync_log`. Daty: model zwraca lokalne `YYYY-MM-DD` lub `YYYY-MM-DDTHH:mm` i `all_day`; konwersja do `timestamptz` w Postgresie (`at time zone 'Europe/Warsaw'`). Pewność < progu ⇒ `status = needs_review`; `cancel` ⇒ `status = cancelled` (lub `needs_review` przy niskiej pewności).
- *Alternatywa:* zapis operacji jako osobnego dziennika i materializacja – większa audytowalność, ale nadmiarowa przy jednej rodzinie; `rationale` + `source_message_ids` wystarczą.

### D8. Android
Kotlin, minSdk 26. `NotificationListenerService` → parser `MessagingStyle` (`extractMessagingStyleFromNotification`, `EXTRA_IS_GROUP_CONVERSATION`, `conversationTitle`), pomija powiadomienia z flagą `FLAG_GROUP_SUMMARY` i bez wiadomości. Klucz idempotencji = UUIDv5 z (pakiet, grupa, autor, timestamp, treść), więc to samo powiadomienie odtworzone ponownie daje ten sam klucz (scenariusz bez duplikatów). Kolejka: Room (`pending_messages`) + WorkManager (`OneTimeWorkRequest` z ograniczeniem sieci i wykładniczym backoffem). Lista śledzonych grup cache'owana z TTL 15 minut (okresowy Worker). Sieć: OkHttp + kotlinx.serialization. Token: `EncryptedSharedPreferences`.
- *Alternatywa:* losowy UUID przy przechwyceniu – nie chroniłby przed ponownym wyświetleniem tych samych wiadomości w kolejnym powiadomieniu.

### D9. PWA
Zapytania `supabase-js` bezpośrednio do tabel (RLS z etapu 1), filtr `status = 'active'`. Strefa czasowa przez `Intl.DateTimeFormat` z `timeZone: 'Europe/Warsaw'` (bez biblioteki dat). Nawigacja dolna: „Dziś”, „Kalendarz”, „Admin” (tylko admin). Widok źródła: RPC `message_context(message_id, before, after)` zwracająca wiadomości grupy wokół wskazanej (odczyt przez RLS).

## Risks / Trade-offs

- [WhatsApp zmienia format powiadomień] → parser oparty na `MessagingStyle` (API systemu, nie WhatsApp), testy jednostkowe na zserializowanych przykładach powiadomień.
- [Nazwa kontaktu w powiadomieniu różni się od nazwy w eksporcie] → klucz dopasowania używa nazwy z tego samego telefonu; scalanie w etapie 4 dopuszcza dopasowanie po treści i minucie przy różnym autorze.
- [Koszt i jakość Haiku] → ewaluacja na 30 przykładach przed każdą zmianą promptu; model w konfiguracji.
- [Halucynacja dat] → aliasy, walidacja zod, próg pewności, link do źródła.

## Migration Plan

Migracja `0004_ingest.sql` (kolumny `idempotency_key`, `received_at`, indeksy, RPC urządzeń, grup i `message_context`). Wdrożenie: migracja → `api` → `worker` → PWA → APK. Wycofanie: wyłączenie śledzenia grup w panelu zatrzymuje przepływ bez utraty danych.

## Open Questions

- Lista grup do śledzenia i ich nazwy wyświetlane – ustawiane w panelu po wdrożeniu, nie zmienia kodu.
