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

## 6. Railway

Utwórz projekt i trzy usługi z tego repozytorium (*Deploy from GitHub repo*). W każdej usłudze: Settings → **Root Directory** puste (cały monorepo), **Config as code** → ścieżka do pliku:

| Usługa | Plik konfiguracji | Zmienne |
| --- | --- | --- |
| `pwa` | `apps/pwa/railway.json` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (tylko publiczne wartości) |
| `api` | `services/api/railway.json` | `LOG_LEVEL` (opcjonalnie) |
| `worker` | `services/worker/railway.json` | `DATABASE_URL` – *Session pooler* (port 5432) z Supabase → Connect; nie *Transaction pooler*, bo kolejka zadań trzyma połączenie |

Dla `pwa` i `api` włącz *Generate Domain*. Zmienne `VITE_*` są wkompilowywane w kod PWA podczas budowania – zmiana wymaga ponownego wdrożenia. Build PWA kończy się strażnikiem `check:secrets`, który przerywa wdrożenie, jeśli w paczce znalazłby się klucz serwerowy.

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
| `api` | `DATABASE_URL` (Supabase → Connect → *Session pooler*), opcjonalnie `INGEST_RATE_LIMIT_PER_TOKEN`, `INGEST_RATE_LIMIT_PER_IP` |
| `worker` | `ANTHROPIC_API_KEY`, `EXTRACTION_MODEL` (np. `claude-haiku-4-5`), opcjonalnie `EXTRACTION_DEBOUNCE_MINUTES` (30), `EXTRACTION_CONFIDENCE_THRESHOLD` (0.7), `EXTRACTION_CONTEXT_MESSAGES` (50) |
| `pwa` | `VITE_API_URL` – publiczny adres usługi `api` (trafia do linku parowania telefonu) |

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
