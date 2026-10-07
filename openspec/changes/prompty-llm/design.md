# Design

## Decisions

### D1. Szablon = instrukcje; dane niezaufane poza nim
Szablon to część promptu systemowego. Placeholdery wypełniane są tylko danymi wpisanymi przez rodzinę (opis przedszkola, dzieci z formami imion i grupami, imiona członków rodziny, imię pytającego). Wiadomości z grup, autorzy i dane ekranu zostają w turze użytkownika w otoczonych blokach – tak jak dotąd. Wartości są escapowane (`escapeTags`/cudzysłowy JSON w analizie, zamknięcie `</przedszkole>` w asystencie), wypełnianie jest jednoprzebiegowe (wartość z `{{…}}` nie jest ponownie podstawiana), puste wartości to „(brak)”.

### D2. Stała część zawsze na końcu
`FIXED_PROMPT_PARTS` (zasady bezpieczeństwa i format odpowiedzi) jest doklejana po szablonie w kodzie usług; edycja szablonu nie może jej usunąć. Niezmiennik „treść wiadomości jako niezaufane dane” obowiązuje niezależnie od szablonu.

### D3. Domyślne w kodzie, własne w bazie
`DEFAULT_PROMPTS` w `@czyzyk/shared/prompts`; wiersz w `llm_prompts` nadpisuje domyślny, brak wiersza = domyślny („Przywróć domyślny” usuwa wiersz). Dzięki temu zmiany domyślnego promptu w kodzie docierają do rodzin, które go nie zmieniały.

### D4. Walidacja placeholderów w dwóch miejscach
PWA blokuje zapis z nieznanym placeholderem; `admin_save_llm_prompt` sprawdza to samo w SQL (`llm_prompt_placeholders`), test bazy pilnuje zgodności list z kodem.

### D5. Cache
Prompt systemowy zależy teraz od danych rodziny (i w asystencie od pytającego), ale jest stały między kolejnymi zapytaniami – cache promptu nadal działa.

## Risks / Trade-offs

- Zły szablon może pogorszyć jakość analizy (np. usunięcie reguł) – stąd „Przywróć domyślny” i opis w panelu; bezpieczeństwa nie osłabi (stała część).
- Nazwy grup trafiają do `{{dzieci}}` (grupa dziecka); są cytowane jak dotąd w bloku `<dzieci>`.
