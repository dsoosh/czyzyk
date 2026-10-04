# Tasks

## 1. Monorepo i narzędzia

- [x] 1.1 Utworzyć npm workspaces (`packages/shared`, `services/api`, `services/worker`, `apps/pwa`), `tsconfig.base.json`, vitest i skrypty `build`/`typecheck`/`test`; weryfikacja: `npm install && npm run typecheck` przechodzi
- [x] 1.2 Dodać szkielet `apps/android` (Gradle, Kotlin, minSdk 26, pusta aktywność „Czyżyk”); weryfikacja: `./gradlew :app:assembleDebug` buduje APK (lub zadanie oznaczone w README jako wymagające Android SDK)
- [x] 1.3 Dodać `packages/shared` z konfiguracją ładowaną i walidowaną przez zod (wspólny helper `loadEnv`); weryfikacja: test jednostkowy odrzuca brakującą zmienną z czytelnym komunikatem

## 2. Schemat bazy i RLS

- [x] 2.1 Napisać `supabase/tests/stub_supabase.sql` i runner testów bazy (vitest, lokalny Postgres z pgvector); weryfikacja: `npm run test:db` startuje na pustej bazie
- [x] 2.2 Migracja `0001_schema.sql`: rozszerzenia, wszystkie tabele z modelu danych, wspólne kolumny elementów LLM, indeksy, `is_family()`/`is_admin()`, RLS i polityki SELECT wg design D3, `revoke` dla `anon`; weryfikacja: testy „anon nie czyta żadnej tabeli”, „zalogowany bez profilu dostaje pusty wynik”, „rodzina czyta wydarzenia”, „rodzina nie może UPDATE/INSERT”, „family nie widzi devices”, „cudzy wątek niewidoczny”
- [x] 2.3 Test-strażnik: każda tabela w schemacie `public` ma włączone RLS; weryfikacja: test zapytujący `pg_class.relrowsecurity` przechodzi i failuje po dodaniu tabeli bez RLS

## 3. Dostęp rodziny

- [x] 3.1 Migracja `0002_auth.sql`: hook `hook_before_user_created`, trigger tworzący profil z rolą i nazwą z metadanych Google, FK `profiles.email → allowed_emails` z cascade; weryfikacja: testy „obcy e-mail odrzucony z 403”, „e-mail o innej wielkości liter przyjęty”, „profil admina ma rolę admin”, „usunięcie z listy kasuje profil i odbiera odczyt”
- [x] 3.2 Migracja `0003_admin_rpc.sql`: `admin_upsert_allowed_email(email, role)`, `admin_delete_allowed_email(email)` z blokadą usunięcia/zdegradowania siebie; weryfikacja: testy „admin dodaje”, „admin nie usuwa siebie”, „family dostaje błąd uprawnień”, „osoba spoza rodziny dostaje błąd uprawnień”
- [x] 3.3 `supabase/config.toml`: tylko dostawca Google, wyłączone e-mail/hasło i magic link, hook zarejestrowany; weryfikacja: `supabase db lint`/przegląd pliku oraz opis w `docs/wdrozenie.md`

## 4. Usługi serwerowe

- [x] 4.1 `services/api`: Fastify, `GET /health`, konfiguracja z env, logger bez treści żądań; weryfikacja: test `inject` zwraca 200 i `{status:"ok"}`
- [x] 4.2 `services/worker`: proces z połączeniem do Postgresa i pg-boss (uruchomienie, graceful shutdown), endpoint/log zdrowia; weryfikacja: test startuje i zatrzymuje workera na lokalnej bazie

## 5. PWA – logowanie

- [x] 5.1 Szkielet PWA (Vite, React, TypeScript, Tailwind, `vite-plugin-pwa` z manifestem PL, React Router); weryfikacja: `npm run build -w @czyzyk/pwa` tworzy `dist` z manifestem i service workerem
- [x] 5.2 Logowanie Google, bramka dostępu (profil / „Brak dostępu” z obsługą błędu hooka), wylogowanie; weryfikacja: testy komponentów z zamockowanym klientem Supabase dla trzech stanów (zalogowany, brak profilu, błąd hooka)
- [x] 5.3 Ekran „Admin → Lista rodziny” (lista, dodaj, zmień rolę, usuń) widoczny tylko dla admina; weryfikacja: test komponentu ukrywa zakładkę dla roli `family`
- [x] 5.4 Test-strażnik sekretów: build PWA nie zawiera `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC`, `VOYAGE`; weryfikacja: skrypt `npm run check:secrets` po buildzie

## 6. Wdrożenie i dokumentacja

- [x] 6.1 Infrastruktura Railway (`.railway/railway.ts`: `api`, `worker`, `pwa`) oraz `.env.example` w każdym pakiecie; weryfikacja: lokalne `npm run build && npm start` w każdej usłudze startuje z wartościami z `.env.example`
- [x] 6.2 `README.md` (struktura, uruchomienie lokalne, testy, workflow OpenSpec) i `docs/wdrozenie.md` (Supabase UE, Google OAuth, hook, pierwszy admin, Railway); weryfikacja: kroki z README wykonane na czystym klonie dają zielone `npm test`
- [ ] 6.3 Weryfikacja kryterium etapu na projekcie chmurowym: logowanie adresem z listy działa, adres spoza listy dostaje „Brak dostępu” i nie pojawia się w `auth.users`; wynik odnotowany w PR
