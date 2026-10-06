# Proposal

## Why

Rodzina widzi tylko elementy wyciągnięte z wiadomości i pojedyncze wiadomości w „skąd to wiem”. Żeby sprawdzić, co dokładnie pisano w grupie (np. bez otwierania WhatsAppa na telefonie właściciela), potrzebny jest widok całej historii każdej śledzonej grupy.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** w PWA zakładka „Czaty” pokazuje śledzone grupy, a po wybraniu grupy – jej wiadomości od najnowszych, z doczytywaniem starszych i wyszukiwaniem po treści.

## What Changes

- PWA: zakładka **Czaty** w dolnym menu – lista śledzonych grup (nazwa wyświetlana, czas i autor ostatniej wiadomości).
- PWA: widok grupy `/czaty/:id` – wiadomości w porcjach po 50, separatory dni, autor i godzina, oznaczenie załącznika i wiadomości prawdopodobnie usuniętej, przycisk „Wcześniejsze wiadomości”, wyszukiwanie po treści.
- Odczyt bezpośrednio z Supabase przez istniejące polityki RLS (`family_read` na `messages` i `wa_groups`); bez zmian w bazie i API.

**Poza zakresem:** wysyłanie wiadomości (aplikacja nigdy nic nie wysyła na WhatsApp), podgląd załączników, edycja i ukrywanie wiadomości, historia grup nieśledzonych.

## Capabilities

### New Capabilities

- `group-history`: przeglądanie i przeszukiwanie historii wiadomości śledzonych grup przez rodzinę.

### Modified Capabilities

(brak)

## Impact

- `apps/pwa`: nowe trasy `/czaty`, `/czaty/:id`, piąta zakładka w dolnym menu, funkcje odczytu w `lib/history.ts`.
- Baza: bez migracji; indeks `messages (group_id, sent_at desc)` już istnieje.
