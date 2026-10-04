# Wdrożenie

Instrukcja pierwszego uruchomienia produkcyjnego (etap 1). Kolejne etapy dopisują tu swoje kroki.

## 1. Supabase (region UE)

1. Na [supabase.com](https://supabase.com) utwórz projekt w regionie **Central EU (Frankfurt)** – wymaganie `data-access-control`: dane w UE.
2. Zanotuj `Project ref`, `Project URL` i klucz `anon` (Project Settings → API). Klucza `service_role` nie wpisuj nigdzie poza zmiennymi usług serwerowych.

## 2. Logowanie Google

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → **OAuth consent screen**: typ *External*, nazwa „Czyżyk”. W trybie *Testing* dodaj e-maile rodziny jako *Test users* (albo opublikuj aplikację).
2. **Credentials → Create credentials → OAuth client ID** → *Web application*.
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Supabase → Authentication → **Sign In / Providers**:
   - **Google**: włącz, wklej Client ID i Client Secret.
   - **Email**: wyłącz (także magic link). **Phone** i **Anonymous sign-ins**: wyłączone.
4. Supabase → Authentication → **URL Configuration**: *Site URL* = adres PWA na Railway (np. `https://czyzyk.up.railway.app`), w *Redirect URLs* dodaj ten sam adres oraz `http://localhost:5173` do pracy lokalnej.

Te same ustawienia opisuje `supabase/config.toml` (dla `supabase start` lokalnie).

## 3. Migracje bazy

Migracje (`supabase/migrations/*.sql`) stosują się **automatycznie przy każdym wdrożeniu** usług `api` i `worker` – to ich *pre-deploy command* w `.railway/railway.ts` (`npm run db:migrate`). Railway uruchamia go po buildzie, a przed przełączeniem ruchu na nową wersję; jeśli migracja się nie powiedzie, wdrożenie zatrzymuje się, a poprzednia wersja działa dalej. Log migracji jest w logach wdrożenia (zakładka *Deploy Logs* → *Pre-deploy*).

Runner (`scripts/migrate.mjs`):
- stosuje tylko brakujące pliki, każdy w osobnej transakcji, w kolejności nazw;
- zapisuje je w `supabase_migrations.schema_migrations` – tej samej tabeli co Supabase CLI, więc `supabase db push` i runner widzą ten sam stan;
- bierze blokadę doradczą, więc równoległe wdrożenie `api` i `worker` jest bezpieczne;
- nie wypisuje `DATABASE_URL`.

Ręcznie (np. przed pierwszym wdrożeniem albo lokalnie):

```bash
DATABASE_URL="postgres://…session-pooler…:5432/postgres" npm run db:migrate
```

Nowa migracja = nowy plik `NNNN_opis.sql` z kolejnym numerem; nigdy nie edytuj zastosowanych plików.

## 4. Hook „Before User Created”

Supabase → Authentication → **Hooks** → *Before User Created* → *Postgres* → schemat `public`, funkcja `hook_before_user_created` → **Enable**.

Bez tego kroku każdy z kontem Google mógłby założyć konto (nie zobaczyłby danych – blokuje to RLS – ale konto by powstało).

## 5. Pierwszy administrator

Jedyna ręczna operacja SQL (Supabase → SQL Editor):

```sql
insert into public.allowed_emails (email, role) values ('twoj.adres@gmail.com', 'admin');
```

Kolejne osoby dodajesz już w PWA: zakładka **Admin → Lista rodziny**.

## 6. Railway (Infrastructure as Code)

Cała konfiguracja Railway – usługi, komendy, healthchecki, polityki restartu, `watchPatterns` i zmienne – jest w [`.railway/railway.ts`](../.railway/railway.ts) (Railway Infrastructure as Code, pakiet `railway/iac`). Stare pliki `railway.json` (Config as Code) zostały usunięte – Railway przestaje je czytać 2026-12-01.

Wymagany Railway CLI ≥ 5.42.1 (`npm i -g @railway/cli`).

```bash
railway login
railway init            # pierwszy raz: utwórz projekt „czyzyk” (albo `railway link` do istniejącego)
npm run infra:plan      # = railway config plan – podgląd zmian
npm run infra:apply     # = railway config apply – utworzenie / aktualizacja usług api, worker, pwa
```

Sekrety nie są w repozytorium – w pliku mają wartość `preserve()`, czyli Railway zachowuje to, co już ma. Ustaw je raz (dashboard → Variables albo CLI):

| Usługa | Zmienne do ustawienia ręcznie |
| --- | --- |
| `api` | `DATABASE_URL` – Supabase → Connect → *Session pooler* (port 5432) |
| `worker` | `DATABASE_URL` (jak wyżej; nie *Transaction pooler* – kolejka zadań trzyma połączenie), `ANTHROPIC_API_KEY` |
| `pwa` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (tylko publiczne wartości) |

```bash
railway variables --service api --set "DATABASE_URL=postgres://…"
```

Pozostałe zmienne (np. `CZYZYK_SERVICE`, `EXTRACTION_MODEL`, limity) ustawia plik. `VITE_API_URL` dla PWA jest referencją do publicznej domeny usługi `api` (`https://${{api.RAILWAY_PUBLIC_DOMAIN}}`).

Domeny: dla `pwa` i `api` włącz *Generate Domain* w dashboardzie (lub dopisz je do pliku i zastosuj). **Zawsze czytaj `railway config plan` przed `apply`** – apply jest deklaratywny i usuwa to, czego nie ma w pliku (wymaga wtedy potwierdzenia).

Jak to działa: każda usługa buduje się z korzenia monorepo (`npm run build`, `npm start`), a `CZYZYK_SERVICE` (`api` / `worker` / `pwa`) wybiera, którą część zbudować i uruchomić (`scripts/service.mjs`). Gdy `CZYZYK_SERVICE` nie jest ustawione, skrypt rozpoznaje usługę po nazwie usługi w Railway (`RAILWAY_SERVICE_NAME`, np. `pwa` albo `czyzyk-pwa`); jeśli nie umie, build kończy się od razu komunikatem, co ustawić. Zmienne `VITE_*` są wkompilowywane w PWA podczas budowania – zmiana wymaga ponownego wdrożenia. Build PWA kończy się strażnikiem `check:secrets`.

## 7. Sprawdzenie etapu 1

1. Otwórz PWA i zaloguj się adresem z listy → widzisz „Dziś i jutro” i zakładkę **Admin**.
2. Zaloguj się kontem Google spoza listy → ekran „Brak dostępu – ten adres nie jest na liście rodziny”.
3. Supabase → Authentication → Users: konta spoza listy nie ma na liście użytkowników.
4. Dodaj w panelu drugiego członka rodziny z rolą *Rodzina* → loguje się, nie widzi zakładki **Admin**.

---

# Etap 2 – pierwszy przepływ danych

## 8. Zmienne usług

| Usługa | Nowe zmienne |
| --- | --- |
| `api` | ustawione w `.railway/railway.ts` (`DATABASE_URL` ręcznie, patrz sekcja 6) |
| `worker` | `ANTHROPIC_API_KEY` ręcznie; `EXTRACTION_*` w `.railway/railway.ts` |
| `pwa` | `VITE_API_URL` ustawia `.railway/railway.ts` (referencja do domeny `api`) |

Migracje: stosują się same przy wdrożeniu (`0004_ingest.sql`), patrz sekcja 3.

## 9. Telefon

1. Zbuduj APK (`apps/android/README.md`) albo pobierz artefakt `czyzyk-debug-apk` z GitHub Actions i zainstaluj na telefonie z WhatsAppem (zezwól na instalację z nieznanych źródeł).
2. W PWA: **Admin → Urządzenia → Dodaj telefon**. Zeskanuj kod QR w aplikacji Czyżyk albo otwórz link na telefonie. Token jest widoczny tylko raz.
3. W aplikacji włącz **dostęp do powiadomień** i wyłącz **optymalizację baterii** (przyciski na ekranie głównym). Na Xiaomi/Samsungu zezwól dodatkowo na autostart.
4. W WhatsAppie ustaw grupom przedszkolnym **cichy dźwięk** zamiast wyciszenia.
5. Gdy w grupie pojawi się pierwsza wiadomość, grupa pokaże się w PWA w **Admin → Grupy**. Zaznacz **Śledź** i nadaj nazwę wyświetlaną (np. „Motylki”). Telefon pobierze listę w ciągu 15 minut.

## 10. Sprawdzenie etapu 2

1. Nauczycielka (lub Ty z drugiego numeru) pisze w śledzonej grupie np. „W piątek bal, przebrania”.
2. Po 30 minutach ciszy w grupie worker wysyła wiadomość do modelu; w ciągu kolejnych kilku minut na ekranie **Dziś i jutro** i w **Kalendarzu** pojawia się wydarzenie „Bal” w piątek z rzeczą „przebranie”. Link „skąd to wiem” pokazuje wiadomość w kontekście rozmowy.
3. W **Admin → Urządzenia** przy telefonie widać „ostatni kontakt: przed chwilą”.
4. Dziennik działania: tabela `sync_log` (rodzaj `extraction`, status `ok`/`partial`/`error`, bez treści wiadomości).
