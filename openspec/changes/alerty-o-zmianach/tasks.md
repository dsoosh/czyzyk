# Tasks

## 1. Alerty

- [x] 1.1 Migracja `0042_change_alerts.sql` (ustawienia, rodzaje i `ref` w `push_alerts_sent`); weryfikacja: `cron.db.test.ts`.
- [x] 1.2 Wynik analizy z rodzajem zmiany i `item_changes.id`; weryfikacja: `run.db.test.ts`.
- [x] 1.3 Alerty `event_new`, `event_changed`, `bring_item_new` w workerze; weryfikacja: `cron.db.test.ts`.
- [x] 1.4 Przełączniki w API i PWA; weryfikacja: `push.db.test.ts`, `Push.test.tsx`.

## 2. Sprawdzenie

- [x] 2.1 `npm run spec:validate`, typecheck, wszystkie testy.
- [ ] 2.2 Nowe wydarzenie z WhatsAppa daje powiadomienie na telefonie; weryfikacja: użytkownik.
