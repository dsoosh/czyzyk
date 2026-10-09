# Proposal

## Why

Przed zmianą `analiza-dwuetapowa` analiza zapisywała przy sprawie dzieci operatora, których dotyczy, także gdy sprawa dotyczyła całej grupy (np. „jutro wycieczka”). Migracja `0033` zamieniła te przypisania na adresatów, więc stare sprawy całej grupy wyglądają jak sprawy jednego dziecka. Nowa rodzina po dodaniu dziecka nie widzi wtedy wspólnych wydarzeń, rzeczy i płatności grupy. Użytkownik zgłosił, że na nowym koncie nie pojawiają się wydarzenia.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** stare sprawy przypisane do wszystkich dzieci operatora z grupy są sprawami całej grupy i widzi je każda rodzina z dzieckiem w tej grupie.

## What Changes

- Migracja danych `0036_whole_group_items.sql`. Sprawa sprzed analizy dwuetapowej staje się sprawą całej grupy (pusta lista adresatów), gdy:
  - nie należy do konkretnej rodziny;
  - jej adresaci to dokładnie wszystkie dzieci pierwszej rodziny (operatora) z grup tej sprawy.
- Przypisanie dzieci (`child_ids`) zostaje, więc u operatora sprawa dalej pokazuje jego dzieci.

**Poza zakresem:** sprawy rzeczywiście adresowane do jedynego dziecka operatora w grupie. Bez ponownej analizy nie da się ich odróżnić od spraw całej grupy, więc też stają się wspólne. To rzadkie i jest mniejszym problemem niż ukryte sprawy całej grupy.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `families`: stare sprawy całej grupy widoczne dla wszystkich rodzin grupy.

## Impact

- Baza: migracja `0036_whole_group_items.sql`, test `supabase/tests/whole-group-items.test.ts`.
