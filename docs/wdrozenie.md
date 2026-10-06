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

### Bez instalowania czegokolwiek – GitHub Actions (zalecane)

Workflow [`Railway`](../.github/workflows/railway.yml) uruchamia Railway CLI na serwerach GitHuba:

1. Railway → projekt → **Settings → Tokens** → utwórz *Project Token* dla środowiska `production`.
2. GitHub → repozytorium → **Settings → Secrets and variables → Actions → New repository secret**: nazwa `RAILWAY_TOKEN`, wartość = token.
3. GitHub → **Actions → Railway → Run workflow** → akcja `plan` (podgląd), potem `apply`.

**Nazwy usług.** Railway dopasowuje usługi z pliku po nazwie i nie umie zmienić nazwy istniejącej usługi. Dlatego plik używa nazw, które Railway nadał automatycznie przy imporcie monorepo: `@czyzyk/api`, `@czyzyk/worker`, `@czyzyk/pwa` (oraz nowa `@czyzyk/cron`). Plan nie powinien nigdy pokazywać usunięcia tych usług – jeśli pokazuje, nie uruchamiaj `apply-destructive`. Odwołania między usługami (domena API dla PWA, domena PWA i adres Supabase dla API, publiczny klucz VAPID) są strukturalnymi referencjami Railway, a nie napisami `${{…}}`.

Potem działa samo: PR zmieniający `.railway/**` dostaje `plan`, a scalenie do `main` robi `apply` (nigdy nie usuwa zasobów – do tego służy ręczna akcja `apply-destructive`). Z tego samego miejsca: `status`, `logs` i `build-logs` wybranej usługi, `redeploy` i `domain`.

### Lokalnie (opcjonalnie)

Railway CLI ≥ 5.42.1 (`npm i -g @railway/cli`):

```bash
railway login
railway link            # w katalogu repo, wybierz projekt
npm run infra:plan      # = railway config plan
npm run infra:apply     # = railway config apply
```

Sekrety nie są w repozytorium – w pliku mają wartość `preserve()`, czyli Railway zachowuje to, co już ma. Ustaw je raz (dashboard → Variables albo CLI):

| Usługa | Zmienne do ustawienia ręcznie |
| --- | --- |
| `api` | `DATABASE_URL` – Supabase → Connect → *Session pooler* (port 5432) |
| `worker` | `DATABASE_URL` (jak wyżej; nie *Transaction pooler* – kolejka zadań trzyma połączenie), `ANTHROPIC_API_KEY` |
| `pwa` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (tylko publiczne wartości) |
| `cron` | `DATABASE_URL` (jak w `worker`), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` – patrz sekcja 11 |

```bash
railway variables --service api --set "DATABASE_URL=postgres://…"
```

Pozostałe zmienne (np. `CZYZYK_SERVICE`, `EXTRACTION_MODEL`, limity) ustawia plik. `VITE_API_URL` dla PWA jest referencją do publicznej domeny usługi `@czyzyk/api` (sama domena; PWA dopisuje `https://`).

Domeny: `@czyzyk/pwa` i `@czyzyk/api` muszą mieć publiczną domenę – bez domeny API referencja `VITE_API_URL` jest pusta. Najprościej: **Actions → Railway → Run workflow → `domain`** z wybraną usługą (pokazuje domenę albo tworzy domenę Railway), potem `redeploy` dla `pwa`. Można też *Generate Domain* w dashboardzie. **Zawsze czytaj `railway config plan` przed `apply`** – apply jest deklaratywny i usuwa to, czego nie ma w pliku (wymaga wtedy potwierdzenia).

Jak to działa: każda usługa buduje się z korzenia monorepo (`npm run build`, `npm start`), a `CZYZYK_SERVICE` (`api` / `worker` / `cron` / `pwa`) wybiera, którą część zbudować i uruchomić (`scripts/service.mjs`). Gdy `CZYZYK_SERVICE` nie jest ustawione, skrypt rozpoznaje usługę po nazwie usługi w Railway (`RAILWAY_SERVICE_NAME`, np. `pwa` albo `czyzyk-pwa`); jeśli nie umie, build kończy się od razu komunikatem, co ustawić. Zmienne `VITE_*` są wkompilowywane w PWA podczas budowania – zmiana wymaga ponownego wdrożenia. Build PWA kończy się strażnikiem `check:secrets`.

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
2. Kilkanaście sekund po przyjęciu wiadomości worker wysyła ją do modelu; w ciągu około minuty na ekranie **Dziś i jutro** i w **Kalendarzu** pojawia się wydarzenie „Bal” w piątek z rzeczą „przebranie”. Link „skąd to wiem” pokazuje wiadomość w kontekście rozmowy.
3. W **Admin → Urządzenia** przy telefonie widać „ostatni kontakt: przed chwilą”.
4. Dziennik działania: tabela `sync_log` (rodzaj `extraction`, status `ok`/`partial`/`error`, bez treści wiadomości).

---

# Etap 3 – codzienne użycie

## 11. Powiadomienia push (VAPID) i nowa usługa `cron`

Push działa przez Web Push ze standardowymi kluczami VAPID. Klucz prywatny zna tylko usługa `cron`; publiczny trafia też do PWA.

1. Wygeneruj parę kluczy na swoim komputerze (wystarczy Node.js, nic nie zostaje zainstalowane):

   ```bash
   npx --yes web-push generate-vapid-keys --json
   ```

   Nie wklejaj klucza prywatnego do czatu ani do repozytorium.
2. Zastosuj `.railway/railway.ts` (scalenie do `main` robi to samo, patrz sekcja 6) – powstaje usługa `@czyzyk/cron`.
3. Ustaw zmienne usługi `cron` (dashboard → `cron` → Variables):
   - `DATABASE_URL` – ten sam *Session pooler* co w `worker`,
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` – z kroku 1,
   - `VAPID_SUBJECT` – `mailto:` z Twoim adresem (usługi push kontaktują się tam w razie problemów).
4. Wdróż ponownie `pwa` (Railway → `pwa` → *Redeploy* albo akcja `redeploy` w workflow), bo `VITE_VAPID_PUBLIC_KEY` (referencja do `VAPID_PUBLIC_KEY` usługi `@czyzyk/cron`) jest wkompilowywany przy budowaniu.

Usługa `@czyzyk/api` dostaje z pliku `SUPABASE_URL` (referencja do `VITE_SUPABASE_URL` usługi PWA) i `PWA_ORIGIN` (domena PWA): na tej podstawie sprawdza sesję użytkownika (klucze JWKS projektu Supabase) i przyjmuje wywołania `/push/*` tylko z PWA. Jeśli projekt Supabase używa jeszcze starego wspólnego sekretu JWT (Settings → JWT Keys → *Legacy JWT secret*), dopisz w `.railway/railway.ts` w usłudze `api` `SUPABASE_JWT_SECRET: preserve()` i ustaw wartość w dashboardzie.

Migracje `0005`–`0008` stosują się same przy wdrożeniu (sekcja 3). Wyłączenie usługi `cron` zatrzymuje powiadomienia bez wpływu na resztę.

## 12. Telefony rodziny

- **Android (Chrome):** PWA → **Ustawienia → Powiadomienia → Włącz powiadomienia** i zezwól.
- **iPhone (iOS 16.4+):** w Safari **Udostępnij → Do ekranu początkowego**, otwórz Czyżyka z ikony, potem **Ustawienia → Powiadomienia → Włącz powiadomienia**. W samej przeglądarce Safari aplikacja pokazuje tę instrukcję zamiast prośby o zgodę.
- Godzinę skrótu (domyślnie 19:00) i rodzaje alertów każdy ustawia u siebie; zmiana obowiązuje od następnego skrótu.
- **Mój kalendarz:** **Ustawienia → Dodaj do mojego kalendarza** → Google / Apple / Outlook. Link widać tylko raz; nowy link unieważnia poprzedni. Google odświeża subskrypcje rzadko (do doby).

## 13. Sprawdzenie etapu 3

1. **Listy → Przynieść:** odhacz rzecz na jutro na jednym telefonie → na drugim po odświeżeniu widać „spakowane: <imię>, <godzina>”.
2. **Listy → Płatności:** oznacz płatność jako zapłaconą, cofnij → wraca „do zapłaty”.
3. Element z niską pewnością pojawia się w **Admin → Przegląd**, a zakładka **Admin** pokazuje licznik. Popraw datę i zatwierdź → element jest w kalendarzu.
4. Subskrypcja kalendarza pokazuje wydarzenia i dni wolne; po unieważnieniu linku plik zwraca 404.
5. Push: dzień przed wydarzeniem o ustawionej godzinie przychodzi „Jutro: …”; stuknięcie otwiera **Dziś i jutro**. Nowy dzień wolny daje jeden alert, nawet gdy pojawi się w kilku wiadomościach.
6. Logi usługi `cron` pokazują tylko liczby („push delivered”, „digest skipped”), bez treści powiadomień.


---

# Import eksportu czatu z PWA

Uzupełnia wiadomości, których nie dostarczyły powiadomienia (np. sprzed sparowania telefonu albo z wyciszonej grupy).

1. W WhatsAppie otwórz grupę → **⋮ → Więcej → Eksportuj czat**. „Bez multimediów” daje plik `.txt`, „Dołącz multimedia” – `.zip`. Oba działają: z ZIP-a PWA czyta w przeglądarce tylko tekst czatu, zdjęcia i filmy nie są nigdzie wysyłane.
2. Przenieś plik tam, gdzie otwierasz PWA (albo otwórz PWA na tym samym telefonie).
3. PWA → **Admin → Import** → wybierz plik. Grupa jest podpowiadana z nazwy pliku (musi być śledzona), podgląd pokazuje liczbę wiadomości i zakres dat.
4. Wybierz, z jakiego okresu nowe wiadomości mają przejść analizę (domyślnie 30 dni; starsze są zapisywane jako historia bez wysyłania do modelu) i stuknij **Importuj**.

Wiadomości znane już z powiadomień albo z wcześniejszego importu są pomijane. Wyniki analizy pojawiają się po kilku minutach (worker sprawdza nowe wiadomości co minutę). Wymaga `SUPABASE_URL` i `PWA_ORIGIN` w usłudze API – ustawia je `.railway/railway.ts`.
