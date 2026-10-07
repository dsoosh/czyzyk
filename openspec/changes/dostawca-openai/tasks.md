# Tasks

## 1. Klient

- [x] 1.1 `OpenAiClient` w `packages/shared` (narzędzie, obrazy, ponawianie, odmowa, zużycie); weryfikacja: testy jednostkowe z atrapą `fetch`

## 2. Usługi

- [x] 2.1 Worker: modele OpenAI (analiza, triaż, kontrola zdjęć), `buildModels`, konfiguracja; weryfikacja: testy wyboru dostawcy i adapterów
- [x] 2.2 API: asystent OpenAI i wybór dostawcy; weryfikacja: testy jednostkowe

## 3. Wdrożenie

- [x] 3.1 `.railway/railway.ts` (`OPENAI_*` jako `preserve()`), `docs/wdrozenie.md`; weryfikacja: `npm run typecheck`, `npm run spec:validate`
