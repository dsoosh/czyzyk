# Design

## Decisions

### D1. Jedno zapytanie, dwie sekcje
`fetchToday` pobiera aktywne rzeczy z terminem od dziś do dziś+7 (posortowane po `due_date`, potem opisie) i dzieli je na „dziś” i „najbliższe dni”. Granice liczone w dniach kalendarzowych Warszawy (`warsawDay`), jak dotąd – po północy ekran przelicza się przy powrocie do aplikacji.

### D2. Etykieta dnia przy rzeczach z tygodnia
W sekcji „W najbliższych dniach” każda rzecz ma etykietę z `dayLabel` („jutro”, „pt 16.10”) jako pierwszy element metadanych – lista jest już posortowana, więc bez nagłówków dni.

### D3. Asystent widzi to samo
Kontekst widoku `today` w API obejmuje wydarzenia i rzeczy od dziś do dziś+7 (ekran i tak pokazuje wydarzenia z 7 dni), płatności i sprawy bez zmian.

## Risks / Trade-offs

- Na desktopie siatka ma teraz pięć sekcji – ostatnia zajmuje pół szerokości; akceptowalne.
