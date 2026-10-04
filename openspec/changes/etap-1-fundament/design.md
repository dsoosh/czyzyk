# Design

## Context

Repozytorium jest puste. Motywacja: `proposal.md` – Why. Wymagania: `specs/family-access`, `specs/data-access-control`. Zmiana dotyka wszystkich części systemu (baza, dwie usługi Node, PWA, szkielet Androida, Railway), więc ustala konwencje dla etapów 2–6.

## Goals / Non-Goals

**Goals:**
- Jedna, spójna struktura monorepo i narzędzia, z których korzystają wszystkie kolejne etapy.
- Kompletny schemat bazy z RLS od pierwszej migracji, tak by żaden etap nie dodawał tabeli „na chwilę bez RLS”.
- Automatyczne testy reguł dostępu na prawdziwym Postgresie.

**Non-Goals:**
- Logika domenowa (ingest, ekstrakcja, ekrany treści) – etapy 2+.
- CI/CD poza tym, co daje Railway (deploy z gałęzi) i lokalne `npm test`.

## Decisions

### D1. Monorepo na npm workspaces
`packages/shared` (typy, schematy zod, stałe), `services/api`, `services/worker`, `apps/pwa`; `apps/android` poza workspaces (Gradle). Wspólny `tsconfig.base.json`, vitest w katalogu głównym.
- *Alternatywa:* pnpm/Turborepo – szybsze przy dużych repo, ale dodatkowe narzędzie bez zysku przy 4 pakietach; Railway i Node 22 obsługują npm bez konfiguracji.

### D2. Pełny schemat w migracji bazowej
Migracja `0001_schema.sql` tworzy wszystkie tabele z `docs/specyfikacja.md` (w tym te używane dopiero w etapach 3–6) wraz z RLS; `0002_auth.sql` – hook i trigger profili; `0003_admin_rpc.sql` – RPC admina. Wyjątek: zgodnie z decyzją „zdjęcia tylko na telefonie” (`docs/specyfikacja.md`) nie powstaje tabela `albums` ani kolumna `attachments.album_id`; `attachments` przechowuje wyłącznie dokumenty (kolumny kontroli obrazów dochodzą w etapie 4). Elementy wyciągane przez LLM mają wspólne kolumny (`source_message_ids`, `confidence`, `rationale`, `status`, `updated_at`) i `group_id` (null = całe przedszkole).
- *Alternatywa:* tabele dodawane per etap – mniej martwych tabel na starcie, ale każdy etap musiałby pamiętać o RLS; jeden przegląd polityk jest bezpieczniejszy.

### D3. Wzorzec RLS
- `is_family()` = `exists(profiles where id = auth.uid())`, `is_admin()` analogicznie z `role = 'admin'`; obie `security definer`, `stable`, `search_path = ''`.
- Tabele domenowe: tylko polityka `SELECT ... using (is_family())` dla roli `authenticated`; brak polityk INSERT/UPDATE/DELETE ⇒ zapis z klienta niemożliwy. `revoke all` dla `anon` na wszystkich tabelach.
- Tabele admina (`allowed_emails`, `devices`, `sync_log`): `SELECT using (is_admin())`.
- Tabele prywatne (`chat_threads`, `chat_messages`, `push_subscriptions`, `ical_tokens`): `SELECT using (user_id = auth.uid() and is_family())`.
- Zapis z klienta tylko przez funkcje `security definer`, które same sprawdzają `is_family()`/`is_admin()` i zmieniają wyłącznie swoje pola.
- Usługi serwerowe łączą się z bazą jako właściciel/`service_role` (omija RLS).
- *Alternatywa:* polityki UPDATE ograniczone kolumnami (`grant update (packed_by)`) – trudniejsze do audytu i nie pozwalają ustawić `packed_by = auth.uid()` wymuszenie; RPC daje jedno miejsce walidacji.

### D4. Usunięcie z listy = utrata dostępu
`profiles` ma klucz obcy do `allowed_emails(email)` z `on delete cascade`. Usunięcie adresu kasuje profil, więc `is_family()` od razu zwraca `false` także dla aktywnej sesji (scenariusz w `family-access`). Konto w `auth.users` zostaje (nie ma danych), ponowne dodanie adresu odtwarza profil przy następnym logowaniu przez trigger `on auth.users update` lub RPC „przywróć”.
- *Alternatywa:* kasowanie użytkownika z `auth.users` – wymaga Admin API z serwera; cascade w bazie działa natychmiast i bez usług.

### D5. Hook „Before User Created” w Postgresie
Funkcja `public.hook_before_user_created(event jsonb)` sprawdza `lower(event->'user'->>'email')` w `allowed_emails`; przy braku zwraca `{"error": {"http_code": 403, "message": "..."}}`. Uprawnienie `execute` tylko dla `supabase_auth_admin`. Profil tworzy trigger `after insert on auth.users`. Wyłączenie logowania hasłem/magic linkiem w konfiguracji Auth (`supabase/config.toml` + dokumentacja dla projektu chmurowego).
- *Alternatywa:* hook HTTP w `services/api` – dodatkowa zależność logowania od dostępności Railway.

### D6. Lokalne testy bazy bez Dockera
Testy w `supabase/tests` uruchamiają migracje na lokalnym Postgresie 16 (z pgvector) po wczytaniu `supabase/tests/stub_supabase.sql`, który odtwarza minimalnie schemat `auth` (`auth.users`, `auth.uid()` z `request.jwt.claim.sub`) i role `anon`/`authenticated`/`service_role`/`supabase_auth_admin`. Testy przełączają rolę przez `set local role` i ustawiają claim, co odwzorowuje zachowanie PostgREST.
- *Alternatywa:* `supabase start` (Docker) – wierniejsze, ale ciężkie i niedostępne w części środowisk; stub testuje dokładnie nasze polityki. Przed wdrożeniem migracje sprawdza też `supabase db push --dry-run`.

### D7. PWA – sesja i bramka dostępu
`supabase-js` z dostawcą Google (`signInWithOAuth`). Po powrocie z OAuth PWA czyta własny profil; brak profilu lub błąd hooka (`error_description` w URL) ⇒ ekran „Brak dostępu” i wylogowanie. Routing: React Router; Tailwind; `vite-plugin-pwa` z manifestem po polsku.

### D8. Railway
Każda usługa ma `railway.json` (`build`/`start` w kontekście całego monorepo, `watchPatterns` na własny katalog i `packages/shared`). PWA serwowana jako statyczny build (`sirv` z fallbackiem SPA). Konfiguracja wyłącznie przez zmienne środowiskowe; `.env.example` w każdym pakiecie.

## Risks / Trade-offs

- [Stub `auth` różni się od prawdziwego Supabase] → stub ogranicza się do `auth.uid()` i `auth.users(id, email, raw_user_meta_data)`; dodatkowo `supabase db push --dry-run` na projekcie chmurowym przed wdrożeniem.
- [Hook trzeba włączyć ręcznie w panelu Supabase] → instrukcja krok po kroku w `docs/wdrozenie.md` i scenariusz ręcznej weryfikacji w zadaniach.
- [Martwe tabele z etapów 3–6] → akceptowalne; pokryte tymi samymi testami RLS.

## Migration Plan

Pierwsze wdrożenie: utworzenie projektu Supabase (region UE), `supabase db push`, włączenie dostawcy Google i hooka, wpisanie e-maila admina SQL-em (jedyna ręczna operacja), utworzenie usług Railway. Wycofanie: brak danych produkcyjnych – usunięcie projektu.
