# Tasks

## 1. Baza i kontrakty

- [x] 1.1 Migracja `0004_ingest.sql`: `messages.idempotency_key` (unikalny), `messages.received_at`, indeks `(group_id, dedupe_key)` unikalny, indeks pod debounce, RPC `admin_create_device`, `admin_revoke_device`, `admin_update_group`, `message_context`; weryfikacja: testy bazy (token zwracany raz i zapisany jako hash, `family` nie tworzy urządzenia, `message_context` pusty dla osoby spoza rodziny)
- [x] 1.2 `packages/shared`: schematy zod ingestu (D1), `normalizeText`, `dedupeKey` (D3), schemat operacji ekstrakcji; weryfikacja: testy jednostkowe normalizacji (białe znaki, wielkość liter, NFC) i stabilności klucza w obrębie minuty

## 2. API ingestu

- [ ] 2.1 Middleware tokenu urządzenia (hash, `revoked_at`, `last_seen_at` z ograniczeniem częstotliwości) i limity zapytań na token i IP; weryfikacja: testy 401 bez tokenu, 401 po unieważnieniu, 429 po przekroczeniu limitu
- [ ] 2.2 `GET /ingest/config` i `POST /ingest/seen-groups` (upsert grup jako nieśledzonych, bez treści); weryfikacja: test, że nowa nazwa pojawia się w `wa_groups` z `tracked = false`
- [ ] 2.3 `POST /ingest/notification` (201/200/400/422, aktualizacja `last_notification_at`, logi bez treści); weryfikacja: testy dla każdego kodu odpowiedzi, test idempotencji i deduplikacji, test, że log nie zawiera treści i autora

## 3. Ekstrakcja

- [x] 3.1 Harmonogram debounce w workerze (skan co minutę, `singletonKey`, blokada doradcza); weryfikacja: test z kontrolowanym zegarem – partia przetwarzana dopiero po oknie ciszy, nowa wiadomość przesuwa termin
- [x] 3.2 Budowa promptu (stały system z ostrzeżeniem o niezaufanych danych, aliasy `W`/`E`, ~50 wiadomości kontekstu, przyszłe elementy, data w Europe/Warsaw); weryfikacja: test snapshot promptu dla przykładowej grupy
- [x] 3.3 Klient modelu z narzędziem `zapisz_operacje`, walidacja zod, mapowanie aliasów i odrzucanie nieznanych, ponowienia z backoffem; weryfikacja: testy z atrapą klienta (poprawna odpowiedź, brak wywołania narzędzia, nieznany alias, błąd 529)
- [x] 3.4 Zapis operacji w transakcji (create/update/cancel dla 6 typów, `ref` w obrębie odpowiedzi, próg pewności → `needs_review`, `processed_at`, `sync_log`); weryfikacja: testy na lokalnej bazie dla scenariuszy „zmiana terminu”, „odwołanie”, „rozmowa bez treści”, „niska pewność”
- [ ] 3.5 Zestaw ewaluacyjny 30 wiadomości (`services/worker/eval/`) i skrypt `npm run eval:extraction` z raportem zgodności; weryfikacja: skrypt działa na prawdziwym modelu i drukuje raport (wymaga `ANTHROPIC_API_KEY`), w CI uruchamiany tylko ręcznie
- [x] 3.6 Dokumentacja zmiennych `EXTRACTION_*` w `.env.example` i README workera; weryfikacja: worker startuje wyłącznie z wartościami z `.env.example` + kluczem

## 4. Panel admina: urządzenia i grupy

- [x] 4.1 Ekran „Urządzenia”: lista z ostatnim kontaktem, dodanie (token + kod QR pokazany raz), unieważnienie; weryfikacja: test komponentu – token znika po zamknięciu okna
- [x] 4.2 Ekran „Grupy”: lista wykrytych grup, przełącznik śledzenia, nazwa wyświetlana; weryfikacja: test komponentu wywołuje `admin_update_group` z poprawnymi argumentami

## 5. Android: czytnik powiadomień

- [ ] 5.1 Parowanie (skan QR / wklejenie linku `czyzyk://pair`), `EncryptedSharedPreferences`, ekran statusu „Połączono z serwerem” / „Urządzenie odłączone”; weryfikacja: test jednostkowy parsera linku i ręczny test na telefonie
- [x] 5.2 Parser powiadomień `MessagingStyle` (grupa vs prywatne, pomijanie podsumowań, placeholdery załączników PL/EN, klucz idempotencji UUIDv5); weryfikacja: testy jednostkowe (Robolectric) na przykładowych powiadomieniach
- [x] 5.3 Filtr śledzonych grup z cache 15 min i zgłaszanie nowych nazw grup; weryfikacja: test jednostkowy – nieśledzona grupa nie trafia do kolejki, jej nazwa trafia do zgłoszenia
- [x] 5.4 Kolejka SQLite + WorkManager z backoffem i obsługą 401/422/429; weryfikacja: test instrumentalny/Robolectric – wiadomość przeżywa restart procesu i jest wysyłana po przywróceniu sieci
- [ ] 5.5 Ekran ustawień: dostęp do powiadomień, optymalizacja baterii, licznik załączników, rozmiar kolejki, ostatnia wysyłka, instrukcja „cichy dźwięk zamiast wyciszenia”; weryfikacja: ręczny test na telefonie z wyłączonym uprawnieniem

## 6. PWA: ekrany treści

- [x] 6.1 Ekran „Dziś i jutro” (sekcje, puste stany, baner dnia wolnego, etykiety grup, odświeżanie przy powrocie); weryfikacja: testy komponentu z ustalonym zegarem (jutro bal, element `needs_review` ukryty, baner dnia wolnego)
- [x] 6.2 Kalendarz – widok listy i miesiąca, szczegóły wydarzenia; weryfikacja: testy komponentu (odwołane ukryte, wybór dnia, zmiana miesiąca)
- [x] 6.3 Widok źródła „skąd to wiem” (kontekst ±10, wyróżnienie, uzasadnienie, słowna pewność); weryfikacja: test komponentu z danymi z `message_context`

## 7. Integracja

- [x] 7.1 Test end-to-end na lokalnej bazie: `POST /ingest/notification` „W piątek bal, przebrania” → worker z atrapą modelu po skróconym oknie ciszy → wydarzenie i rzecz do przyniesienia widoczne zapytaniem jako członek rodziny; weryfikacja: test przechodzi w `npm test`
- [ ] 7.2 Weryfikacja kryterium etapu na produkcji: prawdziwa wiadomość w śledzonej grupie pojawia się w PWA w ≤ 35 minut; wynik i czasy odnotowane w PR
