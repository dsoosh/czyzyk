# Tasks

## 1. Dane i wspólny moduł

- [x] 1.1 `packages/shared/src/prompts.ts` (domyślne szablony, placeholdery, stałe części, wypełnianie); weryfikacja: testy jednostkowe (jednoprzebiegowe wypełnianie, „(brak)”, stała część, nieznane placeholdery)
- [x] 1.2 Migracja `0014_llm_prompts.sql`; weryfikacja: testy bazy (zapis, przywrócenie, nieznany placeholder, uprawnienia, zgodność list z kodem)

## 2. Usługi

- [x] 2.1 Worker: prompt systemowy z szablonu, dane rodziny w placeholderach; weryfikacja: testy promptu i bazy (szablon admina z bazy)
- [x] 2.2 API: prompt systemowy asystenta z szablonu; weryfikacja: testy bazy

## 3. PWA

- [x] 3.1 Admin → Prompty; weryfikacja: testy komponentu (domyślne, wstawianie placeholdera, zapis, przywrócenie, blokada nieznanego placeholdera)
