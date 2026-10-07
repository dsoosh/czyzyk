# Proposal

## Why

Grupa WhatsApp pojawia się w aplikacji dopiero wtedy, gdy telefon przechwyci z niej pierwsze powiadomienie. Do tego czasu admin nie może jej śledzić, więc pierwsze wiadomości z nowej grupy przepadają. Zdarza się też, że ważna wiadomość nie dotarła z powiadomienia (np. telefon był wyłączony, powiadomienie zostało zwinięte), a admin chce ją przekazać ręcznie.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** admin dodaje grupę po nazwie i od razu ją śledzi, a wiadomości skopiowane z WhatsAppa i wklejone w PWA trafiają do analizy jak wiadomości z powiadomień.

## What Changes

- Admin → Grupy: formularz „Dodaj grupę” (nazwa jak w WhatsAppie, opcjonalna nazwa wyświetlana). Nowa funkcja `admin_add_group` normalizuje nazwę tą samą regułą co telefon; istniejąca grupa zostaje włączona, bez duplikatu.
- Admin → Import: sekcja „Wklej wiadomości”. Kilka skopiowanych wiadomości ma nagłówki WhatsAppa (`[18:02, 7.10.2026] Autor: …`), z których brany jest autor i czas; pojedyncza wiadomość to sam tekst, więc admin może podać autora i czas (domyślnie „Nieznany nadawca”, teraz).
- Historia grupy: link „Wklej wiadomość z WhatsAppa” dla admina.
- API: `POST /import/message` (tylko admin, tylko śledzona grupa, maks. 200 wiadomości), źródło wiadomości `manual`, deduplikacja wspólna z powiadomieniami i eksportem, wiadomości od razu do analizy.
- Parser eksportu czatu rozpoznaje też format kopiowania z Androida (godzina przed datą).
- Migracja `0024_manual_entry`: źródło `manual` w `messages`, rodzaj `manual` w `sync_log`, funkcja `admin_add_group`.

**Poza zakresem:** udostępnianie wiadomości z WhatsAppa do Czyżyk Connect, załączniki we wklejanych wiadomościach.

## Capabilities

### New Capabilities

- `manual-message-entry`: admin wkleja wiadomości skopiowane z WhatsAppa.

### Modified Capabilities

- `group-tracking`: admin może dodać grupę po nazwie, zanim telefon ją zgłosi.

## Impact

- Baza: migracja `0024_manual_entry` (bez nowych tabel; RLS bez zmian, funkcja `security definer` z `assert_admin`).
- API: `services/api/src/import/routes.ts`.
- Shared: `parseChatExport`.
- PWA: `GroupsPage`, `ImportPage`, `PasteMessages`, `GroupHistoryPage`, `lib/chatImport`.
- Bezpieczeństwo: dziennik synchronizacji i logi zawierają tylko liczby, bez treści i autorów.
