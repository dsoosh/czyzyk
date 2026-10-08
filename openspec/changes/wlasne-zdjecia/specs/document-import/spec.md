## ADDED Requirements

### Requirement: Własne zdjęcie bez wiadomości w czacie
Zdjęcie udostępnione do aplikacji Android SHALL móc trafić do dowolnej śledzonej grupy wybranej przez użytkownika, także gdy w czacie nie ma odpowiadającej mu wiadomości. Zdjęcie MUST przejść sprawdzenie na telefonie jak inne zdjęcia: na serwer trafia obraz dokumentu bez ludzi albo tylko odczytany tekst. Serwer SHALL utworzyć dla takiego udostępnienia jedną wiadomość w wybranej grupie (autor „Zdjęcie z telefonu”, źródło `manual`, czas udostępnienia), dołączyć do niej wszystkie zdjęcia z tego udostępnienia i przekazać ją do analizy. Grupa nieśledzona MUST być odrzucona.

#### Scenario: Plakat sfotografowany na drzwiach
- **WHEN** rodzic udostępnia do Czyżyk Connect własne zdjęcie plakatu i wybiera grupę Motylki
- **THEN** w historii grupy Motylki pojawia się wiadomość „Zdjęcie z telefonu” z dokumentem, a z jego treści powstają sprawy

#### Scenario: Zdjęcie z czatu
- **WHEN** rodzic udostępnia zdjęcie, a grupa przysłała zdjęcie w ostatnich godzinach
- **THEN** może je dołączyć do tej wiadomości z czatu, jak dotąd
