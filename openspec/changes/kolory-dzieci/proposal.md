# Proposal

## Why

Przy sprawach widać imię dziecka, ale wszystkie etykiety mają ten sam kolor. Przy kilkorgu dzieciach trudno na pierwszy rzut oka odróżnić, czego dotyczy wpis. Rodzina chce, żeby każde dziecko miało swój kolor, do wyboru.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** każde dziecko ma unikalny kolor wybierany w ustawieniach, a etykiety dzieci przy sprawach mają ten kolor.

## What Changes

- Paleta 8 jasnych kolorów (limonkowy, błękitny, różowy, złoty, fioletowy, morski, pomarańczowy, piaskowy), czytelnych z ciemnym tekstem.
- `children.color`: klucz z palety, unikalny w rodzinie. Istniejące dzieci dostają różne kolory w kolejności dodania. Nowe dziecko bez wybranego koloru dostaje pierwszy wolny.
- `save_child` przyjmuje kolor; zajęty kolor jest odrzucany, brak koloru zostawia dotychczasowy.
- Ustawienia → Dzieci: wybór koloru, kolory innych dzieci niedostępne.
- Etykiety dzieci przy sprawach: osobna etykieta na każde dziecko, w jego kolorze.

**Poza zakresem:** kolory w kalendarzu (oznaczenia dni), własne kolory spoza palety.

## Capabilities

### New Capabilities

- `child-colors`: kolor każdego dziecka.

### Modified Capabilities

(brak)

## Impact

- Baza: migracja `0026_child_colors` (kolumna, unikalny indeks, `child_colors()`, nowa sygnatura `save_child`).
- PWA: `lib/children.ts`, `ChildTag`, `ChildrenSection`, strony list i „Dziś”.
