# Proposal

## Why

Po rotacji kluczy na Railway API przez jakiś czas nie łączyło się z bazą. Czyżyk Connect trzymał wtedy wiadomości w kolejce i odkładał kolejne próby z rosnącą przerwą (do 5 godzin). Po naprawie API kolejka dalej stała. „Odśwież teraz” nic nie robiło, bo odświeżenie czekające na ponowienie miało pierwszeństwo przed nowym (KEEP). Ekran statusu nie pokazywał też, dlaczego wysyłka się nie udaje, więc nie było widać, czy winny jest serwer, czy sieć.

Zmiana na prośbę użytkownika. **Gotowe, gdy:**
- „Odśwież teraz” od razu odświeża listę grup i wysyła kolejkę, także gdy wcześniejsze próby czekają na ponowienie;
- ekran statusu pokazuje ostatni błąd połączenia, a znika on po udanym kontakcie z serwerem.

## What Changes

- **Connect, `Work.refreshNow`:** „Odśwież teraz” zastępuje (REPLACE) czekające zadania odświeżenia i wysyłki nowymi, uruchamianymi od razu.
- **Connect, ostatni błąd:**
  - przyczyna ostatniej nieudanej wysyłki albo odświeżenia jest zapisywana na telefonie (`http 500`, `UnknownHostException`, …);
  - ekran statusu pokazuje ją po polsku w karcie kolejki, z godziną („Ostatni błąd: błąd serwera (HTTP 500) (12:03)”);
  - udana wysyłka albo udane odświeżenie listy grup czyści błąd.
- **Connect, `fetchConfig`:** zwraca wynik z przyczyną błędu zamiast `null`.

## Capabilities

### Modified Capabilities

- `notification-capture`: ręczne odświeżenie i ostatni błąd połączenia.
