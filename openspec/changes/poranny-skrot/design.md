# Design

## Decisions

### D1. Ta sama mechanika co wieczorny skrót
Zadanie co 5 minut „zajmuje” użytkowników, których godzina nadeszła (okno `DIGEST_WINDOW_MINUTES`), ustawiając datę wysłania w tej samej instrukcji `update` – najwyżej jedno wysłanie dziennie, także przy nakładających się przebiegach.

### D2. Przypomnienia jako osobne powiadomienie o porannej godzinie
Jedno powiadomienie z wszystkimi terminami dziś i jutro zamiast osobnego na każdą sprawę – mniej hałasu. Sprawy zapłacone i rozwiązane znikają z przypomnień od razu. Termin, który minął, nie jest przypominany.
