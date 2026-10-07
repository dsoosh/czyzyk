# Tasks

## 1. Analiza

- [x] 1.1 Operacja `join` w schemacie i `parseOperation` (tylko typy z dziećmi); weryfikacja: testy jednostkowe
- [x] 1.2 `loadOtherItems` w `batch.ts`, blok `<elementy_innych_grup>` w zapytaniu, zasada w stałej części promptu; weryfikacja: `run.db.test.ts`, snapshot promptu
- [x] 1.3 `resolve.ts`: join tylko na sprawy innych grup, update/cancel na nie odrzucone; weryfikacja: `resolve.test.ts`
- [x] 1.4 `applyJoin`: suma dzieci, źródła, historia, bez powiadomienia, próg pewności; weryfikacja: `run.db.test.ts`
- [ ] 1.5 Na produkcji: wspólna sprawa w grupach dwojga dzieci daje jedną sprawę z obojgiem; weryfikacja: użytkownik
