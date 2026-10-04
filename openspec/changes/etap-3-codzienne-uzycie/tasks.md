# Tasks

## 1. Oznaczanie wykonania

- [x] 1.1 Migracja `0005_tracking.sql`: RPC `mark_packed`, `mark_paid`, `mark_resolved`; weryfikacja: testy bazy (zapis wykonawcy i czasu, cofnięcie, odrzucenie dla osoby spoza rodziny, brak zmiany innych pól)
- [x] 1.2 Ekrany „Do przyniesienia”, „Płatności”, „Wymaga odpowiedzi”, „Dni wolne” w PWA; weryfikacja: testy komponentów (kto i kiedy, po terminie na górze, załatwione zwinięte)
- [x] 1.3 Checklista na ekranie „Dziś i jutro”; weryfikacja: test komponentu wywołuje `mark_packed` i aktualizuje widok

## 2. Przegląd ekstrakcji

- [x] 2.1 Kolumny `reviewed_by`, `reviewed_at`, `pending_patch`, widok `review_queue`, RPC `review_item` (tylko admin); weryfikacja: testy bazy (zatwierdź, popraw, odrzuć, `family` odrzucony)
- [x] 2.2 Worker: ochrona decyzji admina (propozycja do kolejki zamiast nadpisania); weryfikacja: test zapisu operacji na elemencie z `reviewed_at`
- [x] 2.3 Ekran kolejki w panelu admina z licznikiem na zakładce i formularzem poprawy (walidacja wspólnym schematem zod); weryfikacja: testy komponentów

## 3. iCal

- [ ] 3.1 RPC `create_ical_token`/`revoke_ical_token` i endpoint `GET /ical/{token}.ics`; weryfikacja: testy (404 dla nieznanego/unieważnionego/usuniętego użytkownika, brak `needs_review` i `cancelled`, brak treści wiadomości, snapshot pliku z wydarzeniem całodniowym i godzinowym)
- [ ] 3.2 Ekran „Mój kalendarz” z linkami Google/Apple/Outlook; weryfikacja: test komponentu buduje poprawne URL-e `webcal://` i Google `render?cid=`

## 4. Push

- [ ] 4.1 `/push/subscribe`, `/push/unsubscribe`, ustawienia godziny i rodzajów alertów; weryfikacja: testy API z prawdziwą weryfikacją JWT na kluczu testowym
- [ ] 4.2 Usługa `services/cron` ze skrótem wieczornym (raz dziennie, pomijanie pustych dni, tekst skrótu) i sprzątaniem 404/410; weryfikacja: testy z kontrolowanym zegarem i atrapą `web-push`
- [ ] 4.3 Alerty natychmiastowe z workera (`push-alert`, jednokrotność); weryfikacja: test, że dwie ekstrakcje tego samego dnia wolnego dają jeden alert
- [ ] 4.4 Service worker PWA (wyświetlenie, kliknięcie otwiera „Dziś i jutro”) i onboarding iOS; weryfikacja: ręczny test na Androidzie i iPhonie, wynik w PR
- [ ] 4.5 Usługa `cron` w `.railway/railway.ts` (sprawdzona `railway config plan`) i `.env.example` dla `cron`, dokumentacja VAPID w `docs/wdrozenie.md`; weryfikacja: usługa startuje lokalnie
