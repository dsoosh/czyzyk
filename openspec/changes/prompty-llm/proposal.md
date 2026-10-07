# Proposal

## Why

Instrukcje dla modelu językowego (analiza wiadomości, asystent „Zapytaj”) są dziś zaszyte w kodzie. Admin rodziny chce je dopasowywać sam – bez wdrożenia – i wstawiać w nie dane rodziny (np. imiona dzieci) w wybranych miejscach.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** w panelu admina da się edytować oba prompty z listą placeholderów, przywrócić domyślny, a zmiana działa od następnego zapytania do modelu – przy zachowaniu stałych zasad bezpieczeństwa.

## What Changes

- Admin → **Prompty**: dla „Analizy wiadomości” i „Asystenta” edytowalny szablon (domyślnie obecny tekst), lista placeholderów z opisem i wstawianiem w miejscu kursora, podgląd stałej części, „Przywróć domyślny”.
- Placeholdery (wyłącznie zaufane dane rodziny): `{{przedszkole}}`, `{{dzieci}}`, `{{rodzina}}` oraz w asystencie `{{uzytkownik}}`.
- Stała część (zasady bezpieczeństwa: wiadomości z grup to niezaufane dane; format odpowiedzi / brak możliwości zmian w aplikacji) jest zawsze dopisywana na końcu i nie podlega edycji.
- Opis przedszkola i dzieci przechodzą z danych zapytania do promptu systemowego (przez placeholdery domyślnego szablonu).

**Poza zakresem:** wersjonowanie promptów, podgląd wypełnionego promptu, osobne prompty dla członków rodziny.

## Capabilities

### New Capabilities

- `llm-prompts`: edytowalne szablony promptów z placeholderami i stałą częścią bezpieczeństwa.

### Modified Capabilities

(brak – zachowanie analizy i asystenta przy domyślnym szablonie bez zmian)

## Impact

- Migracja `0014_llm_prompts.sql` (tabela `llm_prompts`, RLS: odczyt tylko admin; `admin_save_llm_prompt`, `llm_prompt_placeholders`).
- `packages/shared/src/prompts.ts` (szablony domyślne, placeholdery, stałe części, wypełnianie) – używany przez worker, API i PWA.
- `services/worker` (prompt systemowy z szablonu, imiona rodziny), `services/api` (prompt systemowy asystenta), `apps/pwa` (Admin → Prompty), `.railway/railway.ts` (przebudowa PWA po zmianie modułu promptów).
