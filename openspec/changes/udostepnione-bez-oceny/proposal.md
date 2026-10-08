# Proposal

## Why

Zdjęcie udostępnione do Czyżyk Connect jest oceniane na telefonie tak samo jak zdjęcia znalezione automatycznie w WhatsApp Images: czy to dokument i czy widać ludzi. Ocena myli się przy zdjęciach robionych samemu (plakat sfotografowany pod kątem, kartka z rysunkiem). Odrzuca wtedy dokument albo wysyła sam tekst. Użytkownik udostępnia zdjęcie świadomie, więc wie, że to dokument.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** zdjęcie udostępnione do aplikacji trafia na serwer jako obraz dokumentu bez oceny na telefonie, a serwer nadal usuwa obraz z ludźmi.

## What Changes

- Android: zdjęcia udostępnione do aplikacji (z czatu z ochroną prywatności i własne) nie przechodzą oceny „dokument / ludzie” na telefonie. Telefon nadal:
  - zmniejsza zdjęcie i zapisuje je od nowa, bez metadanych EXIF (np. GPS);
  - odczytuje z niego tekst.
- Zdjęcia znalezione automatycznie w WhatsApp Images są nadal oceniane na telefonie, bez zmian.
- Kontrola serwera bez zmian: obraz z ludźmi jest usuwany i zostaje tylko odczytany tekst.
- Niezmiennik prywatności w `openspec/config.yaml` dostaje wyjątek dla zdjęć świadomie udostępnionych.

**Poza zakresem:** zmiana oceny zdjęć znalezionych automatycznie.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `document-import`: zdjęcia świadomie udostępnione do aplikacji są traktowane jako dokumenty bez oceny na telefonie.

## Impact

- Android: `DocumentScreener.prepare`, `MainActivity` (udostępnianie, komunikaty).
- Prywatność: obraz udostępniony przez użytkownika trafia na serwer i do kontroli modelu także wtedy, gdy są na nim ludzie. Serwer go wtedy nie zatrzymuje.
