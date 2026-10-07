# Proposal

## Why

Admin chce widzieć, co dokładnie trafia do modelu językowego przy analizie wiadomości i co model odpowiada – żeby rozumieć, skąd biorą się (albo czemu nie powstają) sprawy, i poprawiać prompty. Logi serwera z zasady nie zawierają treści wiadomości (`openspec/config.yaml`), więc podgląd musi być osobnym, chronionym miejscem.

## What Changes

- Baza: tabela `llm_calls` z zapytaniem (system, treść), odpowiedzią (operacje albo błąd), zużyciem tokenów i czasem; odczyt tylko dla admina, zapis tylko przez worker, wpisy starsze niż 14 dni są usuwane.
- `services/worker`: każde wywołanie modelu przy ekstrakcji zapisuje wpis (także nieudane).
- PWA: **Admin → LLM** – lista ostatnich wywołań (czas, grupa, wynik, tokeny) z podglądem zapytania i odpowiedzi.

**Poza zakresem:** rozmowy z asystentem „Zapytaj” – są prywatne dla każdego użytkownika i nie trafiają do dziennika. Logi serwera dalej bez treści.

## Capabilities

### New Capabilities

- `llm-call-log`: dziennik wywołań modelu przy analizie wiadomości, widoczny dla admina.

### Modified Capabilities

(brak)

## Impact

- Migracja `0018_llm_calls.sql`; worker (`extraction/run.ts`); PWA (nowa trasa `/admin/llm`).
