# Proposal

## Why

Po zmianie `rodziny` dane mają właścicieli-rodziny, ale analiza nadal działa jak dla jednej rodziny:
- prompt zawiera dzieci i członków „rodziny” (wszystkich profili);
- zasada 12 pomija sprawy, które nie dotyczą „naszych” dzieci;
- znaczniki „[nasza rodzina]” i „[do nas]” nie rozróżniają rodzin.

Przy drugiej rodzinie analiza gubiłaby jej sprawy albo mieszała stan rodzin. Użytkownik chce też obniżyć koszt, wydzielając części zależne od rodziny.

Druga z trzech zmian (po `rodziny`, przed `dolaczanie-rodzin`). Zmiana na prośbę użytkownika. **Gotowe, gdy:**
- analiza grupy jest jednym wywołaniem modelu bez danych rodzin w prompcie systemowym;
- sprawy zapisują adresatów (imiona dzieci);
- przypisanie do dzieci i widoczność dla rodzin liczy baza, także po dodaniu lub usunięciu dziecka.

## What Changes

- **Etap 1, raz na grupę (model):**
  - prompt systemowy bez dzieci i członków rodziny: wspólny dla wszystkich grup i rodzin, więc w całości cache'owany;
  - model zapisuje w `children` imiona dzieci wymienione w wiadomości, w mianowniku, zamiast wybierać z listy i pomijać „nie nasze” sprawy;
  - rodziny z dziećmi w grupie są w treści zapytania jako blok `<rodziny>` (alias R1…, imiona dzieci i ich inne formy);
  - autorzy z rodzin korzystających z aplikacji mają znacznik `[rodzina R1]`, wzmianki o nich `[do R1]`;
  - nowa operacja `done`: rodzina R1 odpowiedziała, zapłaciła albo przyniesie, więc sprawa jest zamknięta tylko dla niej (`item_done`).
- **Etap 2, raz na rodzinę (baza, bez modelu):**
  - sprawy (wydarzenia, rzeczy, płatności, „wymaga odpowiedzi”) mają adresatów `audience` i dodatkowe grupy `extra_group_ids` (wspólne sprawy z `join`);
  - `child_ids` liczy funkcja bazy: dzieci z grup sprawy, których imię lub inna forma imienia pasuje do adresata;
  - przeliczenie następuje po analizie oraz po dodaniu, zmianie i usunięciu dziecka.
- **Widoczność dla rodziny:** grupa sprawy (lub dodatkowa grupa) jest dla niej widoczna, a sprawa dotyczy całej grupy albo jej dziecka. Dotyczy RLS, skrótów, alertów, kalendarza i asystenta.
- **Szablon promptu:** stałe zasady o rodzinach są w niezmiennej części, więc obowiązują także przy szablonie zapisanym przez operatora. Znaczniki `{{dzieci}}` i `{{rodzina}}` w szablonie analizy dostają odsyłacz do bloku `<rodziny>`.

**Poza zakresem:** dopasowanie odmienionych imion przez model w etapie 2. Etap 1 zapisuje mianownik, a baza dopasowuje imię i inne formy imienia.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `families`: adresaci spraw, przypisanie dzieci i widoczność liczone dla rodziny, operacja `done` dla rodziny.

## Impact

- Baza: migracja `0033_audience.sql`, testy `supabase/tests/audience.test.ts`.
- Shared: kontrakt operacji (`done`, opis `children`), szablon i stałe zasady promptu, `mentionsFamily` dla rodziny.
- Worker: `batch.ts`, `prompt.ts`, `resolve.ts`, `apply.ts`, skróty i alerty, testy, snapshot promptu.
