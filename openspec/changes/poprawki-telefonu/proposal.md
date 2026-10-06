# Proposal

## Why

1. W panelu są dwie grupy o identycznie wyglądającej nazwie – jedna śledzona, druga nie. Nazwy z powiadomień Androida bywają otoczone niewidocznymi znakami sterującymi kierunkiem tekstu (np. U+2068/U+2069) albo mają polskie litery w innej postaci Unicode, więc serwer zapisuje je jako różne grupy, a telefon może nie rozpoznać grupy śledzonej.
2. Aplikacja Android nie pojawia się w menu „Udostępnij” przy eksporcie czatu z WhatsAppa, więc eksport trzeba zapisać i wgrać ręcznie w PWA.

Zmiana poza kolejnością etapów, na prośbę użytkownika (zgłoszenie błędów). **Gotowe, gdy:** każda grupa występuje raz (istniejące duplikaty scalone), a eksport czatu udostępniony z WhatsAppa do aplikacji Czyżyk otwiera import z wczytanym czatem.

## What Changes

- Normalizacja nazw grup (Unicode NFC, usunięcie niewidocznych znaków formatujących, zwinięcie białych znaków) na telefonie i na serwerze przy przyjmowaniu nazw.
- Migracja scalająca grupy o tej samej znormalizowanej nazwie: zostaje grupa śledzona (albo z największą liczbą wiadomości), wiadomości, elementy i dzieci przechodzą do niej, ustawienia (śledzenie, nazwa wyświetlana) są łączone.
- Android: aplikacja przyjmuje udostępniony eksport czatu (`.txt` lub `.zip`, także kilka plików). Z ZIP-a odczytuje wyłącznie plik czatu; multimedia nie opuszczają telefonu. Następnie otwiera Admin → Import w PWA z wczytanym czatem.
- PWA: Import przyjmuje czat przekazany przez aplikację Android (most `CzyzykAndroid.takeSharedChat`).

**Poza zakresem:** eksport „na klik” sterowany z aplikacji (etap 4), import bez sesji admina.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `group-tracking`: nazwy grup porównywane i zapisywane w postaci znormalizowanej.
- `chat-export-upload`: import eksportu udostępnionego z WhatsAppa do aplikacji Android.

## Impact

- Migracja `0012_group_name_normalization.sql`; `packages/shared` (schemat ingestu); `apps/android` (parser powiadomień, intent `SEND`, odczyt ZIP); `apps/pwa` (ImportPage).
- Archiwizacja po zmianach, które tworzą te capability (`etap-2-pierwszy-przeplyw-danych`, `import-eksportu-z-pwa`) – tu tylko wymagania ADDED.
