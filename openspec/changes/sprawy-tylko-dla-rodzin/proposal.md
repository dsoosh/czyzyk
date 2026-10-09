# Proposal

## Why

Nauczycielka przesłała do grupy zrzut maila z Centrum Historii Zajezdnia. Mail mówił, że przejazd „Ogórkiem” jest niemożliwy, i pytał organizatora, czy zostać przy terminie, przenieść rezerwację, czy ją anulować. Kolejna wiadomość nauczycielki brzmiała: „Ustalę z resztą kadry co robimy i dam znać”. Analiza poprawnie zaktualizowała wydarzenie, ale utworzyła też sprawę „wymaga odpowiedzi” z pytaniem do rodzin. Użytkownik zwrócił uwagę, że rodziny nic tu nie decydują, więc powinna być tylko aktualizacja wydarzenia.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** stała część promptu analizy mówi, że `action_required` dotyczy tylko decyzji i działań rodzin, a pytania do kadry lub organizatora aktualizują powiązane wydarzenie.

## What Changes

- Nowa sekcja w stałej części promptu analizy („Sprawy wymagające odpowiedzi tylko dla rodzin”). Obowiązuje także przy własnym szablonie operatora.
  - `action_required` tylko wtedy, gdy rodzina musi coś odpowiedzieć, zdecydować, zadeklarować albo zrobić.
  - Gdy decyzja należy do przedszkola, kadry lub organizatora (także w przekazanym mailu lub zrzucie ekranu) albo kadra „ustali i da znać”, analiza robi `update` powiązanego wydarzenia. Gdy decyzja przyjdzie, analiza robi kolejny `update` albo `cancel`.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `families`: zakres spraw „wymaga odpowiedzi”.

## Impact

- Shared: `prompts.ts` (stała część promptu analizy).
- Test: snapshot promptu w `services/worker/src/extraction/prompt.test.ts`.
