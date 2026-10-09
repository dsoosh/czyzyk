# Tasks

## 1. Baza

- [x] 1.1 Migracja `0034_access_requests.sql`: hook przyjmuje konta Google, `access_requests`, RPC admina i rodziny; weryfikacja: `supabase/tests/access-requests.test.ts`.

## 2. Powiadomienie

- [x] 2.1 Worker wysyła adminom push o nowych prośbach jeden raz; weryfikacja: `cron.db.test.ts`.

## 3. PWA

- [x] 3.1 Ekran oczekiwania na akceptację; weryfikacja: `AuthProvider.test.tsx`.
- [x] 3.2 Prośby w panelu admina; weryfikacja: `AllowedEmailsPage.test.tsx`.
- [x] 3.3 Sekcja „Moja rodzina” w ustawieniach; weryfikacja: `Family.test.tsx`.

## 4. Sprawdzenie

- [x] 4.1 `npm run spec:validate`, typecheck, wszystkie testy.
- [ ] 4.2 Nowa osoba loguje się, operator dostaje powiadomienie i akceptuje; weryfikacja: użytkownik.
