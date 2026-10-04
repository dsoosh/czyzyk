# Proposal

## Why

Po etapie 5 system ma wszystkie funkcje, ale trzy słabości z sekcji „Ryzyka” pozostają bez zabezpieczenia: rodzina nie wie, że dane się zestarzały (telefon jedynym źródłem), nie widać awarii czytnika i eksportu, a wiadomości usunięte z grupy wciąż napędzają elementy. Do tego zdjęcia z całego roku warto zebrać w album roku do fotoksiążki.

Etap 6 z `docs/specyfikacja.md` („Szlify”). **Gotowe, gdy:** galeria dzieli albumy na lata przedszkolne i pozwala pobrać zaznaczone oryginały jako ZIP; po 24 godzinach bez danych wszyscy widzą baner o nieaktualnych informacjach; wiadomość usunięta z grupy przenosi swoje elementy do przeglądu.

## What Changes

- Galeria: podział na lata przedszkolne (wrzesień–sierpień), zaznaczanie zdjęć do fotoksiążki, pobranie oryginałów jako ZIP.
- Zdrowie synchronizacji: status „ostatnia synchronizacja X godzin temu” w panelu admina, dziennik błędów synchronizacji, baner nieaktualnych danych dla wszystkich po 24 h, alerty push dla admina o awarii eksportu i milczącym urządzeniu.
- Obsługa usuniętych wiadomości: wiadomość z powiadomienia nieobecna w eksporcie obejmującym jej czas dostaje `deleted_suspected`, a jej elementy – `needs_review`.

**Poza zakresem:** zamawianie fotoksiążki w zewnętrznym serwisie, automatyczne przywracanie wiadomości.

## Capabilities

### New Capabilities

- `sync-health`: widoczność stanu i awarii przepływu danych z telefonu dla admina i rodziny.

### Modified Capabilities

- `photo-gallery`: dochodzi podział na lata przedszkolne, zaznaczanie do fotoksiążki i pobieranie ZIP (nowe wymagania).
- `export-import`: dochodzi wykrywanie wiadomości usuniętych z grupy (nowe wymaganie).

## Impact

- Baza: tabela zaznaczeń fotoksiążki, widok stanu synchronizacji, kolumny `deleted_detected_at`.
- `services/api`: `POST /media/photobook.zip` (strumieniowanie ZIP z oryginałami).
- `services/worker`: krok wykrywania usuniętych wiadomości w imporcie.
- `services/cron`: sprawdzanie świeżości danych i alerty dla admina.
- `apps/pwa`: baner, ekran „Synchronizacja” w panelu admina, rozbudowa galerii.
