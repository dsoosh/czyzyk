# Design

## Context

Każda tabela ma dziś regułę RLS `is_family()`, czyli „ma profil, więc widzi wszystko”. Znaczniki wykonania siedzą w wierszach elementów. Dzieci, imiona i kolory są globalnie unikalne. Serwer (worker, API) czyta bazę połączeniem serwisowym bez ograniczeń.

## Goals / Non-Goals

**Goals:**
- Widoczność liczona w bazie, a nie w kliencie.
- Dzisiejsze dane i zachowanie bez zmian dla jednej rodziny.
- Elementy grupy pozostają wspólne. Tylko stan wykonania jest osobny dla każdej rodziny.

**Non-Goals:**
- Wiele rodzin na użytkownika.
- Ukrywanie elementów grupy według imion dzieci. To zmiana `analiza-dwuetapowa` z adresatami elementu.

## Decisions

- **Pomocnicze funkcje w bazie:**
  - `my_family()`: rodzina zalogowanego, z profilu;
  - `family_sees_group(family, group)`: grupa jest wspólna albo chodzi do niej dziecko tej rodziny; używa jej też serwer;
  - `visible_group(group)`: admin, albo rodzina widzi grupę, albo grupa jest pusta (całe przedszkole);
  - `item_visible(type, id)` dla historii zmian.

  Wszystkie są `security definer` i `stable`. Alternatywa, czyli kolumna `family_id` na elementach, kopiowałaby elementy na rodziny i podwajała koszt analizy. Odrzucona.
- **Operator widzi wszystko:**
  - RLS daje adminowi pełny wgląd, bo panel przeglądu, grup i czatów obejmuje wszystkie grupy;
  - skróty i alerty liczone na serwerze zawsze używają widoczności rodziny, także dla admina.
- **Stan wykonania w `item_done`:**
  - klucz `(item_type, item_id, family_id)`, z `done_by`, `done_at` i `resolution`;
  - stare kolumny są usuwane po przeniesieniu wartości do pierwszej rodziny;
  - widoki `family_*` (`security_invoker`, więc RLS elementów działa) łączą element ze stanem rodziny pod dawnymi nazwami kolumn. Dzięki temu UI i filtry `paid_at is null` w zapytaniach zostają.
  - Alternatywa, czyli scalanie w kliencie, wymagałaby drugiego zapytania na każdej liście. Odrzucona.
- **Rodzina nowego adresu:** wyzwalacz na `allowed_emails` wpisuje pierwszą rodzinę, gdy `family_id` jest puste, i tworzy ją, gdy nie istnieje. `sync_profile` kopiuje `family_id`. Zmiana `dolaczanie-rodzin` zastąpi to wyborem przy akceptacji.
- **Wybór grupy dziecka:** RLS na `wa_groups` pokazuje tylko grupy widoczne. Nowa rodzina nie ma dzieci, więc nie widziałaby żadnej. Dlatego listę do wyboru zwraca RPC `trackable_groups()` (id i nazwa śledzonych grup).
- **Kontekst analizy:** filtry płatności i spraw przestają pytać o „zapłacone” i „rozwiązane”. Element jest w kontekście, gdy termin minął najwyżej 30 dni temu albo, bez terminu, gdy powstał w ciągu 60 dni.

## Risks / Trade-offs

- [Wyciek przez zapomnianą tabelę lub RPC] → testy izolacji dla każdej tabeli domenowej i dla RPC czytających dane (`attachment_image`, `message_context`).
- [Wolniejsze RLS przez funkcje na wiersz] → dane są małe; funkcje są `stable` i opakowane w `select` tam, gdzie argument jest stały.
- [Operator widzi na „Dziś” grupy, do których nie chodzą jego dzieci] → akceptowalne, bo to jego telefon i jego grupy. Ewentualny filtr „tylko moja rodzina” później.

## Migration Plan

Jedna migracja:
1. Tworzy rodzinę i przypisuje do niej wszystkie adresy, profile i dzieci.
2. Śledzone grupy bez żadnego dziecka oznacza jako wspólne, żeby członkowie rodziny bez roli admina dalej je widzieli.
3. Przenosi znaczniki wykonania do `item_done`.
4. Usuwa stare kolumny.
5. Podmienia polityki i RPC.

Wycofanie: odtworzenie kolumn z `item_done` w migracji odwrotnej. Nie jest planowane.
