# Proposal

## Why

Stare sprawy (sprzed analizy dwuetapowej) miały zapisane tylko dzieci operatora, których dotyczyły, również przy ogłoszeniach dla całej grupy. Migracja `0033` uznała je za sprawy tych dzieci, więc nowe rodziny nie widziały wspólnych wydarzeń. Migracja `0036` uznała je za sprawy całej grupy, więc wszystkie rodziny widzą też sprawy cudzych dzieci (np. „Zosia zapomniała kapci”). Użytkownik zgłosił, że mimo przypisanych dzieci wszyscy widzą sprawy nie swoich dzieci. Chce, żeby sprawy były przeliczane pod kątem dzieci nowego użytkownika po dodaniu dziecka.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** stara sprawa jest dla dzieci wymienionych w jej wiadomościach, a bez imion jest dla całej grupy; dodanie dziecka przelicza stare sprawy.

## What Changes

- Migracja `0037_legacy_item_audience.sql`:
  - znacznik `legacy_audience` przy starych sprawach z przypisanymi dziećmi, które nie należą do konkretnej rodziny;
  - `named_children()`: dzieci z grup sprawy (dowolnej rodziny) wymienione w treści wiadomości źródłowych, także w odmianie (np. „Zosi”, „Antka”, „Lence”);
  - `refresh_item_children()` najpierw liczy adresatów starych spraw z wiadomości, potem przypisanie dzieci;
  - przeliczenie następuje od razu, przy każdym dodaniu, zmianie i usunięciu dziecka (`save_child`, `delete_child`) oraz po analizie.
- Stara sprawa bez imion w wiadomościach jest sprawą całej grupy.

**Poza zakresem:** ponowna analiza starych wiadomości modelem.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `families`: adresaci starych spraw liczeni z treści wiadomości.

## Impact

- Baza: migracja `0037_legacy_item_audience.sql`, test `supabase/tests/legacy-item-audience.test.ts`.
