# Proposal

## Why

Przy wycieczkach i wyjazdach trzeba wiedzieć, gdzie dzieci jadą i dokąd je zawieźć. Często to dwa różne miejsca: cel to np. ZOO, a zbiórka jest na dworcu PKP albo przed Bazą. Wydarzenie miało tylko pole `location`, bez wskazówek dla modelu. Nie było go też na ekranie „Dziś” ani w skrótach. Użytkownik chce, żeby analiza wyciągała miejsce wydarzeń.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** analiza zapisuje miejsce docelowe i miejsce zbiórki, a aplikacja i skróty je pokazują.

## What Changes

- Baza: kolumna `events.meeting_point` (miejsce zbiórki lub odbioru, do 200 znaków); migracja `0030_event_meeting_point`.
- Kontrakt analizy: pole `meeting_point` (opcjonalne, nullable) i opisy obu pól:
  - `location` to cel, czyli gdzie wydarzenie się odbywa;
  - `meeting_point` to miejsce, dokąd przywieźć lub skąd odebrać dzieci, gdy to nie przedszkole.
- Prompt: zasada 19 z przykładami („zbiórka na dworcu PKP”, „wyjazd sprzed Bazy”) i rozpoznawaniem miejsc z bloku `<przedszkole>`. Podanie lub zmiana miejsca istniejącego wydarzenia to update. Istniejące elementy w prompcie mają oba pola, więc update nie gubi zbiórki.
- PWA:
  - strona wydarzenia: „Miejsce” i „Zbiórka”, każde z linkiem „Mapa” do wyszukiwania w Mapach Google;
  - „Dziś” i kalendarz: 📍 miejsce i „zbiórka: …”;
  - historia zmian: etykieta „Zbiórka”.
- Skróty poranny i wieczorny: „Wycieczka 08:00 (ZOO; zbiórka: dworzec PKP)”.
- Asystent: zbiórka w kontekście wydarzeń.

**Poza zakresem:**
- przegląd propozycji zmian (nie edytuje zbiórki);
- subskrypcja kalendarza (LOCATION zostaje miejscem docelowym).

## Capabilities

### New Capabilities

- `event-location`: miejsce docelowe i miejsce zbiórki wydarzenia.

### Modified Capabilities

(brak)

## Impact

- Baza: `0030_event_meeting_point.sql`.
- Shared: `extraction.ts`, `prompts.ts`.
- Worker: `batch.ts`, `apply.ts`, `push/format.ts`, `push/digest.ts`, testy, snapshot promptu.
- API: kontekst asystenta.
- PWA: `EventPage`, `TodayPage`, `CalendarPage`, `items.ts`, `changes.ts`, testy.
