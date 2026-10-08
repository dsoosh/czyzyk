## ADDED Requirements

### Requirement: Dokumenty zawsze do pełnej analizy
Partia nowych wiadomości, w której choć jedna wiadomość ma dokument (obraz albo tekst odczytany ze zdjęcia), MUST trafić do pełnej analizy bez wstępnej oceny regułami i tanim modelem.

#### Scenario: Zdjęcie kalendarza bez podpisu
- **WHEN** w grupie pojawia się zdjęcie kalendarza dni wolnych bez tekstu wiadomości
- **THEN** wiadomość trafia do pełnej analizy, a tani model nie jest pytany
