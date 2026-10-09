# Proposal

## Why

Powiadomienia WhatsAppa mają limit znaków. Długa wiadomość trafia do Czyżyka ucięta, a model nie wyciąga z niej informacji z obciętej części. Użytkownik wkleił pełną treść ręcznie, ale wstępna ocena modelu (triaż) uznała ją za duplikat wcześniejszej wiadomości i pominęła, choć zawierała więcej informacji.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** wklejona ręcznie wiadomość zawsze trafia do pełnej analizy, a model wie, że to może być pełna wersja uciętej wiadomości.

## What Changes

- Worker: paczka z wiadomością wklejoną ręcznie (`source = 'manual'`) omija reguły pogawędki i triaż, tak jak zdjęcie dokumentu.
- Prompt analizy: wiadomość wklejona ręcznie ma znacznik `[wklejona ręcznie]`. Nowa zasada 18 mówi, że to zwykle pełna treść uciętej wiadomości z powiadomienia. Analiza nie traktuje jej jako duplikatu i wyciąga brakujące informacje: nowe elementy albo update istniejących.

**Poza zakresem:**
- odczyt pełnej treści z powiadomienia na telefonie (WhatsApp sam ucina tekst);
- zastępowanie uciętej wiadomości wklejoną.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `message-triage`: wiadomość wklejona ręcznie omija triaż i jest oznaczona dla analizy.

## Impact

- Worker: `batch.ts` (`BatchMessage.manual`), `run.ts`, `prompt.ts`, test `run.db.test.ts`.
- Prompt analizy (`packages/shared/src/prompts.ts`), snapshot promptu.
