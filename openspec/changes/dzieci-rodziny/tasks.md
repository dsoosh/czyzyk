# Tasks

## 1. Baza

- [x] 1.1 Migracja `0010_children.sql`: tabela `children`, RLS, `child_ids` w czterech tabelach, RPC `save_child`/`delete_child`; weryfikacja: testy bazy (rodzina dodaje i edytuje, duplikat imienia, osoba spoza rodziny odrzucona, brak bezpośredniego zapisu)

## 2. Ekstrakcja

- [x] 2.1 Kontrakt: pole `children` operacji; weryfikacja: testy jednostkowe `parseOperation`
- [x] 2.2 Worker: lista dzieci w prompcie, imiona przy istniejących elementach, zapis `child_ids` (create, update), nieznane imiona pomijane; weryfikacja: test promptu i testy bazy `runGroupExtraction`

## 3. PWA i asystent

- [x] 3.1 Ustawienia → Dzieci (lista, „Dodaj dziecko”, edycja, usuwanie); weryfikacja: testy komponentu (wywołania RPC)
- [x] 3.2 Imię dziecka przy elementach na Dziś i Listach; weryfikacja: testy komponentów (przypisanie wprost i z grupy)
- [x] 3.3 Kontekst asystenta z imionami dzieci; weryfikacja: test bazy kontekstu
