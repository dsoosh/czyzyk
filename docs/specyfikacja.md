# Asystent przedszkolny – specyfikacja dla Claude Code

Oct 4, 2026 · @Darek

> Dokument źródłowy. Wymagania wykonawcze żyją w `openspec/` (zmiany `etap-1` … `etap-6`,
> po archiwizacji w `openspec/specs/`). Przy rozbieżności obowiązuje OpenSpec.

## Decyzje podjęte po specyfikacji

- **2026-10-04 – zdjęcia tylko na telefonie.** Obrazy z eksportu są analizowane wyłącznie na telefonie.
  Na serwer trafiają tylko obrazy dokumentów z informacjami organizacyjnymi (plan, jadłospis, plakat,
  ogłoszenie), na których nie wykryto ludzi. Zdjęcia ludzi i dzieci, filmy i notatki głosowe nigdy nie
  opuszczają telefonu. Z obrazu, który ma tekst i twarze, wysyłany jest tylko tekst rozpoznany na telefonie.
  W konsekwencji odpadają: galeria, albumy, album roku i pobieranie do fotoksiążki, tabela `albums`,
  kategoria `class_photo` i narzędzie chatbota `get_album`. Poniższe sekcje o zdjęciach z zajęć są nieaktualne.

## Cel i zakres

Prywatna aplikacja rodzinna (PWA), która automatycznie wyciąga z grup WhatsApp przedszkola wydarzenia, rzeczy do przyniesienia, płatności i zdjęcia z zajęć oraz odpowiada na pytania o historię rozmów.

- **Użytkownicy:** tylko rodzina. Logowanie przez Google, dostęp wyłącznie dla adresów z listy dozwolonych.
- **Źródło danych:** wyłącznie telefon właściciela z Androidem, czyli grupy, w których jest. Dane trafiają na serwer z powiadomień (na bieżąco) i z eksportu czatu (na klik, ze zdjęciami).
- **Bez ingerencji w protokół WhatsApp:** nie używamy Cloud API ani nieoficjalnych bibliotek (Baileys, whatsapp-web.js). Aplikacja nigdy nic nie wysyła na WhatsApp.
- **Poza zakresem:** inni rodzice jako użytkownicy, iOS jako źródło danych, wiele telefonów-źródeł.
- **Język:** interfejs i treści po polsku.

## Architektura

```
Telefon (Android) ──► api (Railway) ──► worker (Railway) ──► Supabase (Postgres, Storage)
                                         │  Claude, Voyage         ▲
PWA ─────────── supabase-js (RLS) ───────┼─────────────────────────┘
PWA ──► api: chatbot (SSE), iCal, Web Push
```

Telefon wysyła dane do usługi `api` na Railway, `worker` przetwarza je z pomocą Claude i Voyage, a wyniki trafiają do Supabase. PWA czyta dane bezpośrednio z Supabase (supabase-js z RLS), a chatbot, iCal i push idą przez `api`.

## Aplikacja Android

Natywna aplikacja w Kotlinie, instalowana ręcznie z pliku APK (nie przez Sklep Play, bo używa usługi ułatwień dostępu do automatyzacji). Ma dwa moduły: czytnik powiadomień i eksport na klik.

### Czytnik powiadomień

- `NotificationListenerService` filtruje powiadomienia z `com.whatsapp` i `com.whatsapp.w4b`, tylko z grup oznaczonych jako śledzone (lista pobierana z serwera).
- Z `MessagingStyle` wyciąga nazwę grupy, autora, treść i znacznik czasu, potem wysyła na `POST /ingest/notification`. Pomija zbiorcze podsumowania typu „5 nowych wiadomości”.
- Placeholdery załączników („📷 Zdjęcie”, dokument) oznacza flagą `has_attachment` i zwiększa licznik zaległych załączników.
- Kolejka offline (Room + WorkManager) z ponawianiem i kluczem idempotencji generowanym po stronie klienta.
- Znane ograniczenia: brak powiadomień przy otwartym czacie i dla wyciszonych grup (grupy mają mieć cichy dźwięk zamiast wyciszenia). Ekran ustawień prosi o wyłączenie optymalizacji baterii.

### Eksport na klik

- **Wyzwalacz:** lokalne powiadomienie „Zsynchronizuj czaty”, gdy licznik załączników jest większy od zera albo od ostatniego eksportu minęło N godzin i są nowe wiadomości (N w ustawieniach). Do tego przycisk w apce i kafelek Szybkich ustawień.
- **Przebieg:** po kliknięciu `AccessibilityService` dla każdej śledzonej grupy otwiera czat → ⋮ → Więcej → Eksportuj czat → Dołącz multimedia → w oknie udostępniania wybiera własną aplikację.
- **Odbiór:** apka jest celem udostępniania (`ACTION_SEND`), odbiera ZIP i wysyła go przez podpisany URL do Supabase Storage, a potem rejestruje paczkę przez `POST /ingest/export`.
- **Odporność:** selektory po `resource-id`, tekst PL/EN jako zapas, timeout na każdym kroku. Błąd trafia na serwer z nazwą kroku i wersją WhatsAppa.
- Działa tylko przy odblokowanym ekranie i zawsze startuje z kliknięcia użytkownika.

### Uwierzytelnienie

Token urządzenia generowany w panelu admina PWA, zapisany w `EncryptedSharedPreferences`. Endpointy `/ingest/*` przyjmują tylko ten token.

## Backend i przetwarzanie

Node.js + TypeScript na Railway w trzech usługach: `api` (ingest, endpointy PWA, chatbot), `worker` (parsowanie eksportów, LLM, triaż zdjęć) i `cron` (przypomnienia push, ponowienia). Kolejka zadań w Postgresie (np. pg-boss), bez osobnego Redisa.

### Ingest i deduplikacja

- Wiadomości z powiadomień zapisywane od razu jako `messages` ze źródłem `notification`.
- Eksport: rozpakowanie ZIP i parser `_chat.txt`. Musi obsłużyć różne formaty daty zależne od języka telefonu, wiadomości wieloliniowe, komunikaty systemowe i znaczniki załączników (np. „(plik załączony)”) powiązane z plikami w ZIP-ie.
- Klucz dopasowania: grupa + autor + czas zaokrąglony do minuty + hash znormalizowanej treści. Wersja z eksportu scala się z wersją z powiadomienia i wygrywa, bo ma załączniki.
- Wiadomość z powiadomienia, której brakuje w eksporcie obejmującym jej czas, dostaje status `deleted_suspected`, a wyciągnięte z niej elementy przechodzą na `needs_review`.
- Zdjęcia deduplikowane po hashu percepcyjnym (pHash), nie po nazwie pliku.

### Ekstrakcja przez LLM

- **Kiedy:** nieprzetworzone wiadomości grupy idą do modelu zaraz po przyjęciu (z telefonu lub eksportu), po kilkunastu sekundach zbierających serię wiadomości (zmiana `ekstrakcja-w-czasie-rzeczywistym`; pierwotnie 30 minut ciszy).
- **Kontekst w prompcie:** nowe wiadomości, ostatnie ok. 50 wiadomości grupy oraz aktualne przyszłe elementy z bazy razem z ich ID.
- **Wynik:** JSON przez tool use z operacjami `create`, `update` i `cancel` na: wydarzeniach, rzeczach do przyniesienia, płatnościach, sprawach „wymaga odpowiedzi”, dniach wolnych i faktach do ściągawki. Każdy element ma `source_message_ids`, `confidence` i krótkie uzasadnienie.
- Element z `confidence` poniżej progu dostaje status `needs_review` i czeka w panelu admina.
- **Modele:** Claude Haiku do ekstrakcji i triażu, Claude Sonnet do chatbota i przypadków trudnych. Nazwy modeli w konfiguracji, nie w kodzie.

### Triaż zdjęć

- Jedno wywołanie modelu z wizją: obraz + tekst sąsiednich wiadomości. Zwraca `category` (`document`, `class_photo`, `other`), podpis i ewentualne wyciągnięte elementy w tym samym formacie co ekstrakcja tekstu.
- `document` (plan, jadłospis, plakat): ekstrakcja, obraz zostaje jako źródło. `class_photo`: do albumu; zdjęcia jednego autora wysłane w ciągu 10 minut tworzą jeden album z podpisem z otaczającego tekstu. `other`: pomijane.
- Miniatury i wersje WebP generowane przy zapisie (sharp).

### Indeks pod chatbota

Każda wiadomość i podpis zdjęcia dostaje embedding (model wielojęzyczny, np. Voyage AI) w pgvector. Wyszukiwanie hybrydowe: wektory + `pg_trgm`.

## Model danych (Supabase)

Postgres z pgvector i pg_trgm. Historia wiadomości jest przechowywana na stałe, bo korzysta z niej chatbot. Surowe paczki ZIP są kasowane po sparsowaniu.

| Tabela | Kluczowe pola |
| --- | --- |
| `allowed_emails` | email, role (`admin`, `family`) |
| `profiles` | id (= auth.users), email, display_name, role |
| `devices` | id, name, token_hash, last_seen_at |
| `wa_groups` | id, wa_name, display_name (np. „Motylki”), tracked, last_export_at, last_notification_at |
| `messages` | id, group_id, author, sent_at, text, source (`notification`, `export`), dedupe_key, has_attachment, status (`active`, `deleted_suspected`), processed_at, embedding |
| `attachments` | id, message_id, storage_path, thumb_path, mime, phash, category, caption, album_id |
| `albums` | id, group_id, title, date, cover_attachment_id |
| `events` | id, group_id (null = całe przedszkole), title, starts_at, ends_at, all_day, location |
| `bring_items` | id, event_id?, description, due_date, packed_by, packed_at |
| `payments` | id, description, amount_pln, due_date, paid_by, paid_at |
| `action_required` | id, question, due_date, resolved_by, resolved_at |
| `closures` | id, date_from, date_to, reason |
| `facts` | id, category (godziny, kontakt, osoba, inne), label, value |
| `chat_threads`, `chat_messages` | user_id, role, content, cited_message_ids |
| `push_subscriptions` | user_id, endpoint, p256dh, auth |
| `ical_tokens` | user_id, token_hash, created_at, revoked_at |
| `sync_log` | kind (`notification`, `export`, `extraction`), status, error_step, wa_version, created_at |

Tabele z elementami wyciągniętymi przez LLM (`events`, `bring_items`, `payments`, `action_required`, `closures`, `facts`) mają wspólne kolumny: `source_message_ids uuid[]`, `confidence`, `rationale`, `status` (`active`, `needs_review`, `cancelled`) i `updated_at`.

Storage: prywatny bucket `exports` (ZIP-y, kasowane po parsowaniu) i prywatny bucket `media` (zdjęcia, dokumenty, miniatury), dostęp tylko przez krótko ważne podpisane URL-e.

## PWA: ekrany i funkcje

React + Vite + TypeScript, `vite-plugin-pwa`, `supabase-js`, Tailwind. Hostowana na Railway jako osobna usługa. Projekt mobile-first, bo głównie używana na telefonie.

### Ekrany

- **Dziś i jutro (ekran główny):** co przynieść jutro jako checklista, najbliższe wydarzenia, płatności z terminem, sprawy „wymaga odpowiedzi” i wyraźny baner, gdy zbliża się dzień wolny.
- **Kalendarz:** widok listy i miesiąca. Każdy użytkownik ma prywatny link subskrypcji iCal (`GET /ical/{token}.ics`) do Google, Apple lub Outlooka.
- **Do przyniesienia:** wspólna checklista z informacją, kto spakował i kiedy.
- **Płatności:** lista z kwotą, terminem i statusem „zapłacone”.
- **Wymaga odpowiedzi:** pytania do rodziców (pomoc przy balu, zgody) z terminem i oznaczeniem „załatwione”.
- **Galeria / album roku:** albumy chronologicznie, podzielone na lata przedszkolne (wrzesień–sierpień). Zaznaczanie zdjęć do fotoksiążki i pobranie oryginałów jako ZIP.
- **Ściągawka:** godziny otwarcia, imiona nauczycielek, kontakty, zbierane automatycznie i edytowalne ręcznie.
- **Źródło:** przy każdym elemencie link „skąd to wiem”, który otwiera wiadomość w kontekście rozmowy.

### Chatbot

- Zakładka „Zapytaj” z pytaniami w rodzaju „kiedy jest pasowanie?” albo „co pisali o wycieczce?”.
- Claude Sonnet z narzędziami (tool use) zamiast samego RAG: `search_messages` (wyszukiwanie hybrydowe), `list_events`, `list_bring_items`, `list_payments`, `get_facts` i `get_album`.
- Odpowiedzi strumieniowane (SSE), zawsze z odnośnikami do wiadomości źródłowych. Gdy w historii nie ma odpowiedzi, bot mówi to wprost zamiast zgadywać.
- Wątki zapisywane per użytkownik.

### Powiadomienia push (Web Push, VAPID)

- Wieczorny skrót o godzinie ustawionej przez użytkownika (domyślnie 19:00): „Jutro: strój sportowy, 10 zł na teatrzyk”.
- Natychmiastowe alerty: nowy dzień wolny, nowa sprawa „wymaga odpowiedzi”, płatność z terminem na jutro.
- Na iPhonie push działa tylko po dodaniu PWA do ekranu głównego, więc onboarding ma to pokazać.

### Panel admina

- Kolejka `needs_review`: zatwierdź, popraw albo odrzuć element.
- Grupy: które śledzić i pod jaką nazwą je wyświetlać.
- Urządzenia (tokeny apki Android), lista dozwolonych e-maili, dziennik błędów synchronizacji.
- Status „ostatnia synchronizacja X godzin temu”. Po ponad 24 godzinach bez danych wszyscy użytkownicy widzą baner, że informacje mogą być nieaktualne.

## Bezpieczeństwo i prywatność

Dostęp jest egzekwowany w bazie (RLS), nie tylko w interfejsie, bo klucz `anon` jest publiczny w kodzie PWA.

- **Logowanie:** Google OAuth w Supabase Auth. Hook „Before User Created” odrzuca adresy spoza `allowed_emails`, więc obcy nie założy nawet konta.
- **RLS na każdej tabeli:** odczyt tylko dla użytkowników z `profiles` (funkcja pomocnicza `is_family()`). Zapis wyłącznie przez usługi serwerowe, poza wąskimi funkcjami RPC: oznacz spakowane, oznacz zapłacone, oznacz załatwione, własne wątki chatbota. Funkcje administracyjne sprawdzają `role = 'admin'`.
- **Klucze:** `service_role`, Anthropic i Voyage tylko w zmiennych środowiskowych na Railway. Frontend zna wyłącznie klucz `anon`.
- **Tokeny:** tokeny urządzeń i linki iCal są długie, losowe, przechowywane jako hash i możliwe do unieważnienia. Feed iCal zawiera tylko wydarzenia, nigdy treści wiadomości ani zdjęcia.
- **Multimedia:** wyłącznie przez podpisane URL-e ważne krótko (np. 1 godzinę).
- **Limity zapytań** na `/ingest/*` i na chatbocie.
- **Prompt injection:** treść wiadomości z grup to niezaufane dane. Prompt mówi to modelowi wprost, wynik ekstrakcji jest walidowany schematem (zod), a narzędzia chatbota są tylko do odczytu.
- **Prywatność:** baza zawiera wiadomości innych rodziców i wizerunki cudzych dzieci. Supabase w regionie UE, logi aplikacji bez treści wiadomości, brak funkcji udostępniania czegokolwiek poza rodzinę.

## Kolejność implementacji

Sześć etapów, każdy kończy się działającym narzędziem. Eksport, najbardziej kruchy element, wchodzi dopiero w etapie 4.

1. **Fundament.** Monorepo (`apps/android`, `apps/pwa`, `services/api`, `services/worker`, `supabase/migrations`), migracje z RLS i hookiem logowania, konfiguracja Railway, logowanie Google w PWA.
   - Gotowe, gdy: loguje się tylko e-mail z listy, a pozostałe konta są odrzucane.
2. **Pierwszy przepływ danych.** Czytnik powiadomień, `POST /ingest/notification`, ekstrakcja tekstu przez LLM, ekran „Dziś i jutro” i kalendarz.
   - Gotowe, gdy: wiadomość „w piątek bal, przebrania” pojawia się w PWA jako wydarzenie z rzeczą do przyniesienia w ciągu 35 minut.
3. **Codzienne użycie.** Link iCal, Web Push z wieczornym skrótem, checklisty, płatności, „wymaga odpowiedzi”, dni wolne, kolejka `needs_review` w panelu admina.
4. **Eksport i zdjęcia.** Eksport na klik w apce, parser `_chat.txt`, deduplikacja, triaż zdjęć, galeria, ekstrakcja z dokumentów.
   - Gotowe, gdy: zdjęcie planu miesiąca daje wydarzenia, a zdjęcia z zajęć trafiają do albumu z podpisem.
5. **Chatbot.** Embeddingi, wyszukiwanie hybrydowe, zakładka „Zapytaj”, ściągawka.
6. **Szlify.** Album roku i pobieranie do fotoksiążki, alerty o braku synchronizacji, obsługa usuniętych wiadomości.

**Testy:** parser eksportu na próbkach w formacie polskim i angielskim (jako fixtures) oraz zestaw ok. 30 przykładowych wiadomości z oczekiwanym wynikiem ekstrakcji, uruchamiany przy każdej zmianie promptu.

## Ryzyka i otwarte kwestie

| Ryzyko | Skutek | Zabezpieczenie |
| --- | --- | --- |
| Aktualizacja WhatsAppa zmienia menu | Eksport na klik przestaje działać | Alert w panelu admina. Ręczny eksport z udostępnieniem do apki działa dalej, bo apka jest celem udostępniania. |
| Czat otwarty lub grupa wyciszona | Brak powiadomienia, luka w danych | Eksport uzupełnia luki, grupy ustawione na cichy dźwięk zamiast wyciszenia. |
| Telefon właściciela jedynym źródłem | Przy wyjeździe lub awarii dane się starzeją | Baner o nieaktualnych danych po 24 godzinach. |
| Błędna ekstrakcja LLM | Zły termin lub brakująca rzecz | `confidence`, kolejka `needs_review`, link do źródła przy każdym elemencie, zestaw testów ekstrakcji. |
| Agresywne zarządzanie baterią (Xiaomi, Samsung) | Czytnik powiadomień przestaje działać | Instrukcja w onboardingu apki, monitoring `last_seen_at` urządzenia. |

Dane obejmują tylko grupy, w których jest właściciel telefonu.

### Otwarte kwestie

- [ ] Próbka prawdziwego eksportu `_chat.txt` z telefonu do zbudowania parsera.
- [ ] Lista śledzonych grup i ich wyświetlane nazwy.
- [ ] Adresy e-mail rodziny do `allowed_emails`.
- [ ] Czy zdjęcia z kategorii `other` kasować, czy zachowywać w ukrytym folderze.
