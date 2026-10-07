## ADDED Requirements

### Requirement: Inne formy imienia dziecka
Rodzina SHALL móc wpisać przy dziecku do 10 innych form imienia (pełne imię, zdrobnienia). Jedna forma MUST wskazywać jedno dziecko: zapis formy, która jest imieniem lub formą innego dziecka, MUST zostać odrzucony z czytelnym komunikatem.

#### Scenario: Zdrobnienia Eleny
- **WHEN** rodzic wpisuje przy Elenie „Eleonora, El, Elcia”
- **THEN** formy są zapisane i widoczne przy dziecku

#### Scenario: Forma innego dziecka
- **WHEN** „Wincenty” jest formą Wicka, a rodzic dodaje dziecko o imieniu „Wincenty”
- **THEN** zapis jest odrzucony z komunikatem, że forma należy już do innego dziecka
