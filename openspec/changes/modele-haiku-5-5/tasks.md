# Tasks

## 1. Konfiguracja

- [x] 1.1 `EXTRACTION_MODEL`, `TRIAGE_MODEL`, `CHAT_MODEL` = `claude-haiku-5-5` w `.railway/railway.ts`, `.env.example`, README; weryfikacja: typecheck konfiguracji Railway.

## 2. Sprawdzenie

- [x] 2.1 `npm run spec:validate`, typecheck.
- [ ] 2.2 Konfiguracja wdrożona na Railway (nowy `RAILWAY_TOKEN` albo ręcznie w panelu), panel LLM pokazuje `claude-haiku-5-5`; weryfikacja: użytkownik.
- [ ] 2.3 `npm run eval:extraction` na nowym modelu; weryfikacja: użytkownik (wymaga klucza Anthropic).
