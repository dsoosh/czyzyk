# Czyżyk – asystent przedszkolny

Prywatna aplikacja rodzinna (PWA), która wyciąga z grup WhatsApp przedszkola wydarzenia, rzeczy do przyniesienia, płatności (także ze zdjęć planów i ogłoszeń) oraz odpowiada na pytania o historię rozmów.

- Specyfikacja źródłowa: [`docs/specyfikacja.md`](docs/specyfikacja.md)
- Wymagania wykonawcze: [`openspec/`](openspec/) (spec-driven development, [OpenSpec](https://github.com/Fission-AI/OpenSpec))

## Struktura

```
apps/android        aplikacja na telefon (Kotlin, Gradle → APK) – patrz apps/android/README.md
apps/pwa            aplikacja dla rodziny (React + Vite + Tailwind, Progressive Web App)
services/api        serwer HTTP (Fastify): ingest, iCal, push, chatbot
services/worker     przetwarzanie w tle (pg-boss): ekstrakcja LLM, import eksportów
packages/shared     wspólne schematy (zod), konfiguracja, typy
supabase/           migracje SQL, config.toml, testy bazy i reguł dostępu
openspec/           wymagania i plan prac
docs/               specyfikacja źródłowa, wdrożenie
```

## Uruchomienie lokalne

Wymagania: Node.js ≥ 22.12, PostgreSQL 16 z rozszerzeniem pgvector (do testów bazy).

```bash
npm install
npm run typecheck
npm test                    # wszystkie testy: unit, baza, PWA
npm run test:unit           # bez bazy danych
npm run test:db             # migracje + RLS na lokalnym Postgresie
npm run build
```

Testy bazy tworzą dla każdego pliku osobną bazę na serwerze z `TEST_DATABASE_URL`
(domyślnie `postgres://postgres:postgres@localhost:5432/postgres`) i wczytują
`supabase/tests/stub_supabase.sql` (minimalny odpowiednik schematu `auth` i ról Supabase).
Na Debianie/Ubuntu: `apt install postgresql-16 postgresql-16-pgvector`.

PWA lokalnie (potrzebny projekt Supabase albo `npx supabase start`):

```bash
cp apps/pwa/.env.example apps/pwa/.env.local   # uzupełnij URL i klucz anon
npm run dev -w @czyzyk/pwa                     # http://localhost:5173
```

Usługi: `npm run dev -w @czyzyk/api`, `npm run dev -w @czyzyk/worker` (zmienne jak w `.env.example` w ich katalogach).
Wdrożenie produkcyjne: [`docs/wdrozenie.md`](docs/wdrozenie.md).

## Praca z OpenSpec

Każda zmiana zachowania systemu przechodzi przez OpenSpec:

1. **Propozycja** – `/opsx:propose "opis"` (Claude Code) tworzy `openspec/changes/<nazwa>/` z `proposal.md`, deltami specyfikacji, `design.md` i `tasks.md`.
2. **Implementacja** – `/opsx:apply <nazwa>` realizuje zadania z `tasks.md` i odhacza je.
3. **Archiwizacja** – `/opsx:archive <nazwa>` przenosi zmianę do `openspec/changes/archive/` i scala delty do `openspec/specs/`.

Przydatne komendy:

```bash
npm install
npx openspec list             # zmiany w toku
npx openspec list --specs     # obowiązujące capability
npx openspec show <nazwa>     # podgląd zmiany lub specyfikacji
npm run spec:validate         # walidacja wszystkiego w trybie strict
```

Konwencje projektu (język, stos, niezmienniki bezpieczeństwa, reguły artefaktów) są w [`openspec/config.yaml`](openspec/config.yaml).

## Plan – sześć etapów

| Zmiana | Zakres | Gotowe, gdy |
| --- | --- | --- |
| `etap-1-fundament` | monorepo, schemat z RLS, hook logowania, Railway, logowanie Google | loguje się tylko e-mail z listy |
| `etap-2-pierwszy-przeplyw-danych` | czytnik powiadomień, ingest, ekstrakcja LLM, „Dziś i jutro”, kalendarz | „w piątek bal, przebrania” w PWA w ≤ 35 min |
| `etap-3-codzienne-uzycie` | checklisty, płatności, sprawy, iCal, Web Push, kolejka `needs_review` | codzienne użycie przez rodzinę |
| `etap-4-eksport-i-zdjecia` | eksport na klik, filtr obrazów na telefonie, parser `_chat.txt`, ekstrakcja z dokumentów | plan miesiąca → wydarzenia; zdjęcia ludzi nie opuszczają telefonu |
| `etap-5-chatbot` | embeddingi, wyszukiwanie hybrydowe, „Zapytaj”, ściągawka | odpowiedzi z cytatami |
| `etap-6-szlify` | zdrowie synchronizacji, usunięte wiadomości | baner po 24 h, usunięte → przegląd |

Etapy realizujemy po kolei: etap N+1 zaczyna się po archiwizacji etapu N.
