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

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run   # podgląd
npx supabase db push
```

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

Jak to działa: każda usługa buduje się z korzenia monorepo (`npm run build`, `npm start`), a `CZYZYK_SERVICE` (`api` / `worker` / `pwa`) wybiera, którą część zbudować i uruchomić (`scripts/service.mjs`). Zmienne `VITE_*` są wkompilowywane w PWA podczas budowania – zmiana wymaga ponownego wdrożenia. Build PWA kończy się strażnikiem `check:secrets`.

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

Migracje: `npx supabase db push` (dochodzi `0004_ingest.sql`).

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
