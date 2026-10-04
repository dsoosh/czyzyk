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
