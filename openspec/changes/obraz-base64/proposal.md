# Proposal

## Why

Pierwsze zdjęcie dokumentu, które dotarło na serwer (kalendarz dni wolnych w grupie Fundacja Gaj), skończyło się przy kontroli obrazu błędem 400 z API modelu. Serwer pobiera obraz z bazy przez `encode(bytes, 'base64')`, a Postgres łamie taki wynik na linie po 76 znaków. API modelu odrzuca base64 ze znakami nowej linii. Wcześniej problem był niewidoczny, bo telefon nie wysyłał żadnych obrazów (poprawione w `wczytywanie-zdjec`).

Poprawka błędu, na zgłoszenie użytkownika. **Gotowe, gdy:** kontrola obrazu, analiza z obrazem i podgląd zdjęcia w historii wydarzenia dostają base64 w jednej linii.

## What Changes

- Worker: `translate(encode(bytes, 'base64'), chr(10), '')` przy kontroli dokumentu (`documents.ts`) i przy obrazach do analizy (`batch.ts`).
- Migracja `0027_image_base64`: `attachment_image` zwraca base64 bez łamania linii.
- Dokumenty, przy których kontrola się nie udała, są ponawiane automatycznie przy kolejnym przebiegu analizy grupy. Ponowne wysyłanie z telefonu nie jest potrzebne.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `document-import`: obraz dokumentu przekazywany modelowi i rodzinie w poprawnym base64.

## Impact

- Worker: `extraction/documents.ts`, `extraction/batch.ts`, testy `run.db.test.ts`.
- Baza: migracja `0027_image_base64`, test `event-history.test.ts`.
