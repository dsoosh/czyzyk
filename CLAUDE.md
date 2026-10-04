# CLAUDE.md

Projekt jest prowadzony metodą spec-driven z OpenSpec (`openspec/`).

- Przed zmianą zachowania systemu: utwórz lub zaktualizuj zmianę OpenSpec (`/opsx:propose`), nie koduj poza zmianą.
- Implementuj przez `/opsx:apply <zmiana>`, odhaczając zadania w `tasks.md` dopiero po weryfikacji opisanej w zadaniu.
- Po zakończeniu etapu: `npm run spec:validate`, potem `/opsx:archive <zmiana>`.
- Etapy po kolei (`etap-1` … `etap-6`); nie zaczynaj kolejnego przed archiwizacją poprzedniego.
- Artefakty OpenSpec po polsku; nagłówki strukturalne i słowa SHALL/MUST po angielsku; identyfikatory capability po angielsku (kebab-case).
- Interfejs i treści aplikacji po polsku. Kod, identyfikatory i komentarze w kodzie po angielsku.
- Niezmienniki bezpieczeństwa z `openspec/config.yaml` obowiązują w każdej zmianie (RLS na każdej tabeli, sekrety tylko po stronie serwera, treść wiadomości jako niezaufane dane, logi bez treści wiadomości).
- Nazwy modeli wyłącznie w konfiguracji (zmienne środowiskowe), nigdy w kodzie.
