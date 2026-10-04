# Proposal

## Why

Wszystkie kolejne etapy (ingest, ekstrakcja, PWA, chatbot) zakładają, że baza danych zawiera wiadomości innych rodziców i zdjęcia cudzych dzieci, a klucz `anon` jest publiczny w kodzie PWA. Zanim do bazy trafi pierwsza wiadomość, musi istnieć szkielet projektu i dostęp egzekwowany w samej bazie: tylko rodzina może się zalogować i cokolwiek odczytać.

Etap 1 z `docs/specyfikacja.md` („Fundament”). **Gotowe, gdy:** loguje się tylko e-mail z listy, a pozostałe konta są odrzucane.

## What Changes

- Monorepo: `apps/android` (pusty projekt Gradle), `apps/pwa`, `services/api`, `services/worker`, `packages/shared`, `supabase/migrations`, wspólne narzędzia (TypeScript, vitest, lint).
- Migracja bazowa Supabase: rozszerzenia (`vector`, `pg_trgm`, `pgcrypto`), pełny model danych ze specyfikacji (wszystkie tabele, aby kolejne etapy dodawały tylko kolumny/indeksy), RLS na każdej tabeli, funkcje `is_family()` i `is_admin()`.
- Hook „Before User Created” odrzucający adresy spoza `allowed_emails` oraz automatyczne tworzenie `profiles` z rolą z listy dozwolonych.
- Funkcje RPC administratora do zarządzania listą dozwolonych e-maili.
- PWA: logowanie przez Google (Supabase Auth), ekran „brak dostępu”, pusty ekran główny po zalogowaniu, ekran admina z listą dozwolonych e-maili.
- `services/api` i `services/worker`: szkielety z `GET /health`, konfiguracją ze zmiennych środowiskowych i wdrożeniem na Railway.
- Konfiguracja Railway (usługi `api`, `worker`, `pwa`) i dokumentacja uruchomienia lokalnego.

**Poza zakresem:** jakiekolwiek przyjmowanie danych z telefonu, ekstrakcja LLM, ekrany z treścią (etap 2+), tokeny urządzeń (etap 2), usługa `cron` (etap 3), aplikacja Android poza pustym szkieletem.

## Capabilities

### New Capabilities

- `family-access`: kto może założyć konto i zalogować się do aplikacji (Google, lista dozwolonych e-maili, role `admin`/`family`, zarządzanie listą przez admina).
- `data-access-control`: reguły dostępu do danych egzekwowane w bazie – odczyt tylko dla rodziny, zapis tylko przez usługi serwerowe i wąskie RPC, funkcje administracyjne tylko dla admina, sekrety wyłącznie po stronie serwera.

### Modified Capabilities

(brak – pierwsza zmiana w projekcie)

## Impact

- Nowe repozytorium kodu: wszystkie katalogi monorepo.
- Zależności: `@supabase/supabase-js`, React, Vite, Tailwind, `vite-plugin-pwa`, Fastify, `pg`, vitest.
- Infrastruktura: projekt Supabase w regionie UE (Auth z dostawcą Google, włączony hook „Before User Created”), trzy usługi na Railway.
- Dane: brak (pusta baza z listą dozwolonych e-maili uzupełnianą przez admina).
