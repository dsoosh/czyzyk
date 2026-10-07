# Tasks

## 1. Dane

- [x] 1.1 Migracja `0013_child_aliases.sql`; weryfikacja: testy bazy (zapis i czyszczenie form, kolizje, limity, ponowna analiza: admin tak, rodzina nie)

## 2. Analiza i asystent

- [x] 2.1 Worker: formy imion w prompcie, reguły listy imion i rzeczy bez dnia, przypisanie po formie; weryfikacja: testy promptu i bazy (przypisanie po formie „Zofia”)
- [x] 2.2 Eval: przypadki list imion i sprawdzanie dzieci; weryfikacja: testy oceny; przebieg na prawdziwym modelu (`npm run eval:extraction`) – do wykonania z kluczem API
- [x] 2.3 Asystent: formy imion w kontekście; weryfikacja: test bazy kontekstu

## 3. PWA

- [x] 3.1 Dzieci: pole „Inne formy imienia”, komunikat o kolizji; weryfikacja: testy komponentu
- [x] 3.2 Historia grupy: „Analizuj ponownie” dla admina; weryfikacja: testy komponentu
