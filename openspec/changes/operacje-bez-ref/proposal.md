# Proposal

## Why

Model poprawnie odczytał z ogłoszenia o wycieczce wydarzenie, płatność 60 zł i rzecz do przyniesienia, ale na listach pojawiło się tylko wydarzenie. Płatność i rzecz nie miały pola `ref` (lokalnego identyfikatora). Walidator wymagał tego pola nawet z wartością `null`, więc odrzucił obie operacje.

Poprawka błędu, na zgłoszenie użytkownika. **Gotowe, gdy:** operacja utworzenia bez pola `ref` jest przyjmowana tak samo jak z `ref: null`.

## What Changes

- `ref` w operacji `create` jest opcjonalny; brak oznacza `null`. Opis pola w schemacie narzędzia mówi, że jest potrzebny tylko wtedy, gdy coś się do elementu odwołuje.

**Poza zakresem:** ponowna analiza wiadomości, z których operacje zostały już odrzucone. Admin może je przeanalizować ponownie przyciskiem „Analizuj ponownie”.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `item-extraction`: operacja utworzenia nie musi mieć lokalnego identyfikatora.

## Impact

- `packages/shared/src/extraction.ts` (schemat operacji), testy `extraction.test.ts` i `resolve.test.ts`.
