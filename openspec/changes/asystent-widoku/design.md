# Design

## Context

PWA czyta dane z Supabase (RLS), a operacje wymagające sekretów idą przez `services/api` z weryfikacją sesji (`/push/*`, `/import/*`). Etap 5 planuje pełnego asystenta z wyszukiwaniem i wątkami; ta zmiana dodaje lżejszą wersję związaną z bieżącym widokiem.

## Decisions

### D1. Kontekst budowany na serwerze z opisu widoku
Klient wysyła tylko `view` (rodzaj + identyfikatory: miesiąc, id wydarzenia, id grupy, rodzaj listy, id elementu). Serwer pobiera dane połączeniem serwerowym, po sprawdzeniu, że użytkownik ma profil rodziny – tą samą regułą co `is_family()`. Dzięki temu klient nie może podsunąć modelowi danych spoza bazy ani poszerzyć zakresu, a model widzi to samo, co rodzina w PWA: tylko elementy `active` (bez `needs_review` i odwołanych) i wiadomości grup śledzonych.

| Widok | Dane |
|---|---|
| `today` | wydarzenia dziś i jutro, rzeczy na jutro, otwarte płatności i sprawy, dni wolne w ciągu 14 dni |
| `calendar` (miesiąc) | wydarzenia, dni wolne i rzeczy do przyniesienia w miesiącu |
| `event` | wydarzenie, jego rzeczy do przyniesienia i wiadomości źródłowe z kontekstem ±10 |
| `list` (`bring`, `payments`, `actions`, `closures`) | elementy danej listy (otwarte i ostatnio zamknięte) |
| `group` | nazwa grupy i 200 najnowszych wiadomości |
| `source` (element) | element, uzasadnienie i wiadomości ±20 wokół źródła |
| `general` | elementy z najbliższych 30 dni |

Zawsze dołączana jest bieżąca data (Europe/Warsaw) i dzień tygodnia.

### D2. Jedno wywołanie, bez narzędzi
Dane widoku mieszczą się w kilku tysiącach tokenów, więc nie potrzeba pętli narzędzi. Brak narzędzi oznacza, że wstrzyknięta w wiadomość instrukcja nie może niczego wykonać; prompt systemowy dodatkowo oznacza dane jako niezaufane i każe je ignorować jako polecenia. Prompt systemowy jest stały (cache).

### D3. Historia rozmowy po stronie klienta
Panel trzyma rozmowę w pamięci i wysyła do 10 poprzednich wymian (naprzemiennie użytkownik/asystent, ograniczona długość). Dane widoku dołączane są tylko do bieżącego pytania – przy zmianie ekranu kolejne pytanie widzi nowy widok. Zapis wątków w bazie zostaje na etap 5.

### D4. Model z konfiguracji
`CHAT_MODEL` i `ANTHROPIC_API_KEY` tylko w zmiennych środowiskowych API. Bez nich endpoint zwraca 503, a reszta API działa. Odpowiedź z `stop_reason = refusal` lub bez tekstu zamieniana jest na komunikat „Nie mogę odpowiedzieć na to pytanie.”.

### D5. Limity w pamięci
API działa jako jedna instancja (jak `RateLimiter`), więc limit minutowy (10/min) i dzienny (`ASSISTANT_DAILY_LIMIT`, domyślnie 100, liczony wg daty Europe/Warsaw) trzymamy w pamięci. Restart zeruje licznik – akceptowalne dla jednej rodziny.

## Risks / Trade-offs

- Model może się pomylić → odpowiedź oparta wyłącznie na danych widoku, instrukcja „nie wiem” przy braku danych; w PWA dopisek, że odpowiedzi tworzy model i warto sprawdzić źródło.
- Treść wiadomości trafia do dostawcy modelu → jak w ekstrakcji (etap 2), tylko na serwerze i tylko dla grup śledzonych.
