# Proposal

## Why

Gdy dwoje dzieci chodzi do różnych grup, ta sama sprawa (wycieczka całego przedszkola, ta sama zbiórka pieniędzy) przychodzi w obu grupach w nieco innym brzmieniu. Analiza każdej grupy widzi tylko jej sprawy, więc powstają dwa wydarzenia i dwie płatności o lekko różnych nazwach. Rodzina chce jednej sprawy z obojgiem dzieci.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** sprawa zapowiedziana w drugiej grupie dopisuje dziecko do istniejącej sprawy z pierwszej grupy zamiast tworzyć duplikat.

## What Changes

- Analiza wiadomości grupy dostaje blok `<elementy_innych_grup>`: aktywne wydarzenia, rzeczy do przyniesienia, płatności i sprawy wymagające odpowiedzi z innych śledzonych grup, do których chodzą dzieci rodziny (najwyżej 25 na typ). Blok jest tylko wtedy, gdy dziecko rodziny chodzi też do analizowanej grupy.
- Nowa operacja `join`: dopisuje do sprawy z innej grupy dzieci tej grupy (wymienione albo wszystkie dzieci rodziny z tej grupy) oraz wiadomości źródłowe. Nie zmienia treści, grupy ani statusu sprawy; zapisuje zmianę dzieci w historii; nie wysyła powiadomienia o nowej sprawie.
- Spraw z innych grup nie można zmieniać (`update`) ani odwoływać (`cancel`) z wiadomości tej grupy; `join` działa tylko na sprawy innych grup. Join poniżej progu pewności jest odrzucany.
- Stała część promptu analizy: zasada wspólnych spraw (działa także przy szablonie zmienionym przez admina).

**Poza zakresem:** łączenie duplikatów, które już powstały; sprawy z grup bez dzieci rodziny (np. grupa rodziców).

## Capabilities

### New Capabilities

- `shared-items`: wspólne sprawy dzieci z różnych grup.

### Modified Capabilities

(brak)

## Impact

- Shared: `rawOperationSchema` / `parseOperation` (operacja `join`), stała część promptu analizy.
- Worker: `batch.ts` (sprawy innych grup), `prompt.ts`, `resolve.ts`, `apply.ts` (`applyJoin`).
- Koszt: dłuższe zapytanie tylko dla rodzin z dziećmi w kilku grupach.
