# Proposal

## Why

Przy wygaszonym ekranie wiadomości z WhatsAppa docierały na serwer z dużym opóźnieniem, często dopiero po odblokowaniu telefonu. Telefon w trybie Doze odkłada zadania WorkManagera do okien serwisowych, nawet gdy aplikacja jest zwolniona z optymalizacji baterii. Usługa nasłuchu powiadomień działa jednak dalej, więc może wysłać wiadomość od razu.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** wiadomość przechwycona przy wygaszonym ekranie trafia na serwer od razu po powiadomieniu, a przy braku sieci wysyłkę ponawia WorkManager jak dotąd.

## What Changes

- Android: usługa nasłuchu powiadomień po dodaniu wiadomości do kolejki od razu ją wysyła, w osobnym wątku i pod krótką blokadą wybudzenia (`PARTIAL_WAKE_LOCK`, maks. 60 s).
- Wspólna logika opróżniania kolejki (`Outbox`) dla wysyłki natychmiastowej i dla `SendWorker`, z blokadą przed równoległym wysłaniem tej samej wiadomości.
- Gdy wysyłka natychmiastowa się nie powiedzie (brak sieci, błąd serwera), zadanie trafia do WorkManagera z rosnącym odstępem.
- Uprawnienie `WAKE_LOCK` jawnie w manifeście.

**Poza zakresem:** usługa pierwszoplanowa, okresowa synchronizacja listy grup i zdjęć (zostają w WorkManagerze).

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `notification-capture`: wiadomość jest wysyłana od razu, także przy wygaszonym ekranie; kolejka offline i ponowienia bez zmian.

## Impact

- Android: `Outbox` (nowy), `SendWorker`, `CaptureService`, `AndroidManifest.xml`, testy Robolectric `WorkersTest`.
- Bateria: blokada wybudzenia trwa tylko do końca wysyłki.
