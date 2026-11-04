# Proposal

## Why

Przy zakładce „Admin” pokazuje się licznik (np. „1”). Nie było wiadomo, czego dotyczy ani gdzie tego szukać: liczy elementy w zakładce „Przegląd”, ale sama zakładka niczego nie pokazywała, a kliknięcie „Admin” otwierało „Rodzinę”.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** licznik mówi, co liczy, prowadzi do „Przeglądu”, a zakładka „Przegląd” ma ten sam licznik i krótki opis.

## What Changes

- **Licznik przy „Admin”:** opis „N do przejrzenia w Przeglądzie” (dymek i etykieta dostępności).
- **„Admin” przy oczekujących elementach** otwiera od razu `/admin/przeglad`; bez nich – „Rodzinę” jak dotąd.
- **Zakładka „Przegląd”** w panelu admina pokazuje ten sam licznik.
- **Strona „Do przejrzenia”** ma zdanie, co tam trafia (niepewne sprawy z analizy i zmiany spraw już poprawionych) i co z nimi zrobić.

## Capabilities

### Modified Capabilities

- `admin-review`: licznik kolejki przeglądu.
