# Tasks

## 1. Indeks

- [ ] 1.1 Migracja `0007_search.sql`: indeks HNSW, indeks trigramowy, funkcja `search_messages` (RRF, `security invoker`); weryfikacja: testy bazy z wektorami testowymi (pusty wynik dla osoby spoza rodziny, pominięcie `deleted_suspected`)
- [ ] 1.2 Zadanie `embed-messages` z Voyage, backfill i ponowienia; weryfikacja: testy z atrapą klienta Voyage, dokumentacja `VOYAGE_*` w `.env.example`
- [ ] 1.3 Zestaw 20 pytań wyszukiwania z oczekiwanymi wiadomościami (`npm run eval:search`); weryfikacja: raport recall@5 na prawdziwym modelu

## 2. Asystent

- [ ] 2.1 Narzędzia odczytu działające na JWT użytkownika; weryfikacja: testy, że narzędzia nie widzą danych bez profilu rodziny
- [ ] 2.2 Pętla tool use ze streamingiem, cytaty `[W…]`, zapis wątków, `interrupted`; weryfikacja: testy z atrapą strumienia (cytat zamieniony na odnośnik, przerwanie zapisuje część)
- [ ] 2.3 Endpoint SSE z limitem dziennym; weryfikacja: testy API (401 bez sesji, 429 po limicie, kolejność zdarzeń)
- [ ] 2.4 Zestaw 15 pytań do asystenta (w tym 3 bez odpowiedzi i 2 z próbą wstrzyknięcia) z oceną; weryfikacja: `npm run eval:assistant` drukuje raport
- [ ] 2.5 Zakładka „Zapytaj” w PWA: lista wątków, strumieniowanie, odnośniki do źródeł; weryfikacja: testy komponentów z atrapą SSE

## 3. Ściągawka

- [ ] 3.1 Kolumna `facts.manual`, RPC `upsert_fact`/`delete_fact`, ochrona przed nadpisaniem w workerze; weryfikacja: testy bazy i workera
- [ ] 3.2 Ekran „Ściągawka” z edycją; weryfikacja: testy komponentów
