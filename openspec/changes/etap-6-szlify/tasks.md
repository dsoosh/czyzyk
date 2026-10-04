# Tasks

## 1. Album roku

- [ ] 1.1 Migracja `0008_polish.sql`: `photobook_selections`, RPC `toggle_photobook`, funkcja roku przedszkolnego; weryfikacja: testy bazy (granica 31.08/1.09, odrzucenie dla osoby spoza rodziny)
- [ ] 1.2 `POST /media/photobook.zip` strumieniowo, nazwy plików, limit; weryfikacja: test API generujący ZIP z 3 obrazów testowych i sprawdzający nazwy i kolejność
- [ ] 1.3 Galeria: przełącznik roku, zaznaczanie, licznik, pobieranie; weryfikacja: testy komponentów

## 2. Zdrowie synchronizacji

- [ ] 2.1 `get_sync_freshness()` i baner w PWA (> 24 h); weryfikacja: test bazy i test komponentu z ustalonym zegarem
- [ ] 2.2 Ekran „Synchronizacja” w panelu admina (grupy, urządzenia, dziennik 30 dni bez treści); weryfikacja: testy komponentów
- [ ] 2.3 Alerty admina w `services/cron` (błąd eksportu, urządzenie > 12 h, limit 24 h, tylko admin); weryfikacja: testy z kontrolowanym zegarem

## 3. Usunięte wiadomości

- [ ] 3.1 Krok wykrywania w imporcie (zakres z marginesem, `deleted_suspected`, elementy z jedynym źródłem → `needs_review`); weryfikacja: testy na lokalnej bazie dla trzech scenariuszy ze specyfikacji
- [ ] 3.2 Widok źródła i kolejka przeglądu oznaczają wiadomości `deleted_suspected`; weryfikacja: test komponentu

## 4. Zamknięcie projektu

- [ ] 4.1 Przegląd `openspec/specs` po archiwizacji wszystkich etapów (`openspec validate --all --strict`) i aktualizacja README; weryfikacja: walidacja bez błędów
