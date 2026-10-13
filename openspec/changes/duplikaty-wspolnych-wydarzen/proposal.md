# Proposal

## Why

W wywołaniu analizy grupy Sowy (13.10) model dostał wklejone ogłoszenie o wycieczce do Centrum Historii Zajezdnia 14.10. Wycieczka była już w kontekście jako wydarzenie grupy Wilki, z tytułem „… (bez Ogórka)”. Model utworzył duplikat zamiast `join`. Dodatkowo próbował powiązać płatność z wydarzeniem polem `event`, którego płatność nie ma, więc cała operacja została odrzucona. Użytkownik przekazał wywołanie do analizy.

Zmiana na prośbę użytkownika. **Gotowe, gdy:**
- wydarzenie tego samego dnia w tym samym miejscu albo o tej samej nazwie w innej grupie nie jest dublowane;
- nadmiarowe pole w odpowiedzi modelu nie odrzuca całej operacji.

## What Changes

- **Worker, zabezpieczenie przed duplikatem:**
  - `create` wydarzenia sprawdza aktywne wydarzenia innych grup z tego samego dnia z tym samym miejscem albo tą samą nazwą (bez dopisków w nawiasach);
  - przy trafieniu `create` staje się `join`, a przyprowadzenie i plan dnia z nowej wiadomości uzupełniają puste pola wydarzenia;
  - rzeczy z ref (`nowe…`) wskazują na to wydarzenie;
  - dziennik LLM zapisuje to jako notatkę.
- **Kontrakt analizy:** pola, których typ elementu nie ma, są pomijane z notatką „pominięto nieznane pola”, a reszta operacji zostaje.
- **Prompt (stała część):** to samo wydarzenie tego samego dnia i w tym samym miejscu to `join`, także przy dopisku w tytule albo przy wklejonej, wcześniejszej wersji ogłoszenia.
- **Panel LLM:** notatki w sekcji „Zapisano” i w kopii wywołania.
- **Płatności wydarzeń** (na prośbę użytkownika):
  - `payments.event_id` (migracja `0041_payment_event.sql`, odtworzony widok `family_payments`);
  - pole `event` płatności w kontrakcie analizy, tak jak przy rzeczach do przyniesienia;
  - reguła 5 promptu;
  - strona wydarzenia pokazuje jego płatności.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `families`: wspólne wydarzenia grup bez duplikatów.

## Impact

- Baza: `0041_payment_event.sql`.
- Shared: `extraction.ts` (`parseOperation`, płatność z `event`), `prompts.ts`.
- Worker:
  - `extraction/apply.ts`;
  - `extraction/resolve.ts`;
  - `extraction/run.ts`.
- PWA: `LlmCallsPage`, `EventPage`, `lib/items.ts`, `lib/review.ts`.
