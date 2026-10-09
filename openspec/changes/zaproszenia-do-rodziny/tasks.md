# Tasks

## 1. Baza

- [x] 1.1 Migracja `0035_family_invites.sql`: zaproszenia, przyjęcie ze scaleniem, odrzucenie; weryfikacja: `supabase/tests/family-invites.test.ts`.

## 2. Powiadomienie

- [x] 2.1 Worker wysyła zaproszonemu push jeden raz; weryfikacja: `cron.db.test.ts`.

## 3. PWA

- [x] 3.1 Baner zaproszenia na ekranie „Dziś”; weryfikacja: `TodayPage.test.tsx`.
- [x] 3.2 Zaproszenia w „Moja rodzina”; weryfikacja: `Family.test.tsx`.

## 4. Sprawdzenie

- [x] 4.1 `npm run spec:validate`, typecheck, wszystkie testy.
- [ ] 4.2 Drugi rodzic z osobnym kontem przyjmuje zaproszenie; weryfikacja: użytkownik.
