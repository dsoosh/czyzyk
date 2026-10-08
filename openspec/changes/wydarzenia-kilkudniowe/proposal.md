# Proposal

## Why

Wydarzenia i dni wolne trwające kilka dni (zielona szkoła, ferie, przerwa świąteczna) zaśmiecają kalendarz. Dzień wolny od–do pojawia się na liście pod każdym dniem osobno. Wydarzenie z końcem kilka dni później widać tylko w dniu startu. Analiza czasem zapisuje taki okres jako osobne wpisy na każdy dzień. Użytkownik chce, żeby wpisy kilkudniowe były w kalendarzu jednym wpisem.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** wpis kilkudniowy pojawia się na liście kalendarza raz, z zakresem dat, a w widoku miesiąca oznacza każdy swój dzień.

## What Changes

- Kalendarz (PWA), lista: dzień wolny od–do i wydarzenie trwające kilka dni są pokazane raz, pod pierwszym dniem (albo pod pierwszym dniem widocznego zakresu, jeśli zaczęły się wcześniej), z zakresem dat, np. „pn 12.10 – śr 14.10”.
- Widok miesiąca oznacza każdy dzień wpisu kilkudniowego. Po wybraniu dnia wpis jest pokazany z zakresem dat.
- Kalendarz scala osobne wpisy tej samej grupy w jeden, gdy dotyczą kolejnych dni (dopuszczalna przerwa na weekend):
  - dni wolne z tym samym powodem;
  - jednorazowe całodniowe wydarzenia o tej samej nazwie, także z dopiskiem „dzień 1”, „dzień 2”.
  Scalony wpis prowadzi do pierwszego wydarzenia.
- Kalendarz pobiera też jednorazowe wydarzenia, które zaczęły się przed widocznym zakresem i jeszcze trwają.
- Prompt analizy: wydarzenie trwające kilka dni to jedno wydarzenie ze startem i końcem (dla całodniowego koniec to ostatni dzień). Okres, w którym przedszkole jest nieczynne, to jeden dzień wolny od–do. Nie powstają osobne wpisy na każdy dzień.

**Poza zakresem:**
- scalanie danych w bazie (scalanie jest tylko w widoku);
- ekran „Dziś”;
- skróty;
- subskrypcja kalendarza.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `school-calendar`: wpisy kilkudniowe jako jeden wpis.

## Impact

- PWA: `lib/spans.ts` (nowy), `CalendarPage`, `fetchCalendar`, testy.
- Prompt analizy (`packages/shared/src/prompts.ts`), snapshot promptu.
