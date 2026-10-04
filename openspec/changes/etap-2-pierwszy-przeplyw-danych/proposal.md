# Proposal

## Why

Po etapie 1 aplikacja ma bezpieczny szkielet, ale nie zawiera żadnych danych. Etap 2 domyka pierwszy pełny przepływ: wiadomość w grupie WhatsApp → powiadomienie na telefonie → serwer → model językowy → wydarzenie i rzecz do przyniesienia widoczne w PWA. Dopiero ten przepływ pozwala sprawdzić w praktyce jakość ekstrakcji i niezawodność czytnika powiadomień, na których opierają się kolejne etapy.

Etap 2 z `docs/specyfikacja.md` („Pierwszy przepływ danych”). **Gotowe, gdy:** wiadomość „w piątek bal, przebrania” pojawia się w PWA jako wydarzenie z rzeczą do przyniesienia w ciągu 35 minut.

## What Changes

- Aplikacja Android: parowanie z serwerem tokenem urządzenia, `NotificationListenerService` dla `com.whatsapp` i `com.whatsapp.w4b`, filtr śledzonych grup, kolejka offline z ponawianiem i kluczem idempotencji, licznik zaległych załączników, ekran ustawień (uprawnienia, optymalizacja baterii, status).
- `services/api`: `GET /ingest/config`, `POST /ingest/notification`, `POST /ingest/seen-groups`, uwierzytelnienie tokenem urządzenia, limity zapytań.
- `services/worker`: ekstrakcja elementów przez LLM po 30 minutach ciszy w grupie (operacje `create`/`update`/`cancel`, `confidence`, walidacja schematem, ochrona przed prompt injection).
- Panel admina: urządzenia (wygeneruj / unieważnij token, ostatni kontakt) i grupy (śledź, nazwa wyświetlana).
- PWA: ekran „Dziś i jutro” (tylko odczyt), kalendarz (lista i miesiąc), link „skąd to wiem” do wiadomości w kontekście rozmowy.
- Zestaw ok. 30 przykładowych wiadomości z oczekiwanym wynikiem ekstrakcji (ewaluacja promptu).

**Poza zakresem:** odhaczanie rzeczy/płatności/spraw, iCal, push, kolejka `needs_review` w panelu (etap 3 – elementy o niskiej pewności są już zapisywane jako `needs_review`, ale tylko ukrywane); eksport czatu, załączniki i zdjęcia (etap 4); embeddingi i chatbot (etap 5); baner nieaktualnych danych (etap 6).

## Capabilities

### New Capabilities

- `device-pairing`: tokeny urządzenia źródłowego – wydawanie, przechowywanie, unieważnianie, uwierzytelnianie endpointów ingestu, monitoring ostatniego kontaktu.
- `group-tracking`: które grupy WhatsApp są śledzone i pod jaką nazwą są wyświetlane; wykrywanie nowych grup bez przesyłania ich treści.
- `notification-capture`: przechwytywanie wiadomości z powiadomień WhatsApp na telefonie i niezawodne dostarczanie ich na serwer.
- `message-ingest`: przyjmowanie wiadomości po stronie serwera, idempotencja i deduplikacja.
- `item-extraction`: zamiana wiadomości grup na wydarzenia, rzeczy do przyniesienia, płatności, sprawy „wymaga odpowiedzi”, dni wolne i fakty.
- `today-view`: ekran główny „Dziś i jutro”.
- `school-calendar`: kalendarz wydarzeń i dni wolnych w widoku listy i miesiąca.
- `source-trace`: powiązanie każdego elementu z wiadomościami źródłowymi i ich podgląd w kontekście rozmowy.

### Modified Capabilities

(brak – `family-access` i `data-access-control` obowiązują bez zmian, nowe dane podlegają istniejącym regułom)

## Impact

- `apps/android`: pierwsza funkcjonalna wersja APK (Room, WorkManager, OkHttp, EncryptedSharedPreferences).
- `services/api`, `services/worker`: nowe endpointy, zadania pg-boss, zależność `@anthropic-ai/sdk`, zmienne `ANTHROPIC_API_KEY`, `EXTRACTION_MODEL`, `EXTRACTION_DEBOUNCE_MINUTES`, `EXTRACTION_CONFIDENCE_THRESHOLD`.
- Baza: migracja z RPC admina dla urządzeń i grup, kolumna `idempotency_key` i `received_at` w `messages`, indeksy pod debounce.
- `apps/pwa`: nowe ekrany i nawigacja dolna.
- Koszty: wywołania Claude Haiku (pojedyncze na grupę po ciszy).
