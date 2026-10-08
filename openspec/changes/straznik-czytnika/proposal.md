# Proposal

## Why

Po jakimś czasie telefon przestaje zapisywać powiadomienia WhatsAppa i wiadomości przepadają. Android potrafi odłączyć usługę czytania powiadomień: po aktualizacji aplikacji (także samoczynnej), po zabiciu procesu albo przy oszczędzaniu baterii. Nie zawsze podłącza ją z powrotem. Dostęp do powiadomień jest wtedy nadal włączony, ale aplikacja nic nie dostaje.

Poprawka, na zgłoszenie użytkownika. **Gotowe, gdy:** odłączony czytnik jest podłączany ponownie automatycznie, a ekran telefonu pokazuje, czy czytnik działa.

## What Changes

- `CaptureService.onListenerDisconnected`: od razu prosi system o ponowne podłączenie (`requestRebind`).
- `ListenerWatchdog`: gdy dostęp jest włączony, a czytnik w tym procesie nie jest podłączony, odnawia podłączenie: `requestRebind`, a po 20 s od startu procesu także wyłączenie i włączenie komponentu. Wywoływany:
  - przy okresowej synchronizacji;
  - przy otwarciu aplikacji;
  - po restarcie telefonu i po aktualizacji aplikacji (`RestartReceiver`: `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`).
- Ekran telefonu: linia „Czytnik powiadomień działa” albo „System odłączył czytnik – łączę ponownie”.
- `AppState`: czas ostatniego podłączenia i odłączenia czytnika (do diagnostyki).

**Poza zakresem:** powiadomienia, które przyszły, gdy czytnik był odłączony. Android ich nie przekazuje; można je uzupełnić eksportem czatu albo wklejeniem.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `notification-capture`: automatyczne ponowne podłączanie czytnika powiadomień.

## Impact

- Android: `CaptureService`, `ListenerWatchdog` (nowy), `RestartReceiver` (nowy), `SyncWorker`, `MainActivity`, `AppState`, manifest (`RECEIVE_BOOT_COMPLETED`), test `ListenerWatchdogTest`, `MIN_TESTS`.
