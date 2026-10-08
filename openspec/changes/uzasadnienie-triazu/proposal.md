# Proposal

## Why

Wstępna ocena modelu (triaż) zwraca tylko „tak/nie”. Gdy wiadomość zostanie pominięta albo przepuszczona, nie wiadomo, dlaczego. Użytkownik chce, żeby odpowiedź triażu zawierała uzasadnienie.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** każda wstępna ocena modelu ma krótkie uzasadnienie widoczne w dzienniku wywołań i w szczegółach wiadomości.

## What Changes

- Narzędzie triażu (`ocen_wiadomosci`) dostaje wymagane pole `rationale`: jedno krótkie zdanie po polsku, dlaczego taka ocena. Prompt systemowy prosi o nie.
- Brak lub zły typ uzasadnienia nie unieważnia oceny. Uzasadnienie jest przycinane do 300 znaków.
- Dziennik wywołań zapisuje odpowiedź `{relevant, rationale}`.
- PWA, tylko dla adminów:
  - na liście wywołań uzasadnienie widać pod oceną;
  - w szczegółach wiadomości w czacie uzasadnienie jest pod linkiem „Wstępna ocena”.
- Limit tokenów odpowiedzi triażu: 300 zamiast 200.

**Poza zakresem:** zapisywanie uzasadnienia przy wiadomości (zostaje w dzienniku wywołań, czytelnym tylko dla adminów i usuwanym po 14 dniach).

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `message-triage`: uzasadnienie wstępnej oceny.

## Impact

- Worker: `triage.ts`, `run.ts`, testy.
- PWA: `MessageDetailsPanel`, `LlmCallsPage`, `messageDetails.ts`, testy.
