# Tasks

## 1. Zdrowie synchronizacji

- [ ] 1.1 Migracja `0008_polish.sql` z `get_sync_freshness()` oraz baner w PWA (> 24 h); weryfikacja: test bazy i test komponentu z ustalonym zegarem
- [ ] 1.2 Ekran „Synchronizacja” w panelu admina (grupy, urządzenia, dziennik 30 dni bez treści); weryfikacja: testy komponentów
- [ ] 1.3 Alerty admina w `services/cron` (błąd eksportu, urządzenie > 12 h, limit 24 h, tylko admin); weryfikacja: testy z kontrolowanym zegarem

## 2. Usunięte wiadomości

- [ ] 2.1 Krok wykrywania w imporcie (zakres z marginesem, `deleted_suspected`, elementy z jedynym źródłem → `needs_review`); weryfikacja: testy na lokalnej bazie dla trzech scenariuszy ze specyfikacji
- [ ] 2.2 Widok źródła i kolejka przeglądu oznaczają wiadomości `deleted_suspected`; weryfikacja: test komponentu

## 3. Zamknięcie projektu

- [ ] 3.1 Przegląd `openspec/specs` po archiwizacji wszystkich etapów (`openspec validate --all --strict`) i aktualizacja README; weryfikacja: walidacja bez błędów
