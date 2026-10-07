## ADDED Requirements

### Requirement: Dzieci rozpoznawane po formach imienia i na listach imion
Analiza wiadomości SHALL rozpoznawać dziecko rodziny po imieniu i każdej jego innej formie, także w odmianie, i przypisywać element do dziecka. Lista imion przy prośbie lub informacji SHALL zawężać element do wymienionych dzieci; gdy rodzina ma zapisane dzieci i żadnego z nich nie ma na liście, element MUST NOT powstać.

#### Scenario: Elena na liście
- **WHEN** nauczycielka pisze listę imion z „- Elena” i „Prośba o zakup i doniesienie sprayu przeciwko insektom”, a rodzina ma dziecko Elena
- **THEN** powstaje rzecz do przyniesienia „spray przeciwko insektom” przypisana do Eleny

#### Scenario: Wincenty to Wicek
- **WHEN** na liście jest „Wincenty”, a „Wincenty” to forma imienia Wicka
- **THEN** element jest przypisany do Wicka

#### Scenario: Nikogo z rodziny na liście
- **WHEN** lista imion nie zawiera żadnego dziecka rodziny
- **THEN** analiza nie tworzy elementu

### Requirement: Termin rzeczy do przyniesienia bez dnia
Rzecz do przyniesienia, przy której wiadomość nie podaje dnia, SHALL dostać termin na najbliższy dzień roboczy po wysłaniu wiadomości.

#### Scenario: Prośba w poniedziałek
- **WHEN** w poniedziałek 5.10 przychodzi „prośba o doniesienie sprayu” bez dnia
- **THEN** rzecz ma termin na wtorek 6.10

### Requirement: Ponowna analiza wiadomości
Admin SHALL móc wysłać pojedynczą wiadomość do ponownej analizy z historii grupy; analiza MUST uwzględniać istniejące elementy (aktualizacja zamiast duplikatu). Pozostali członkowie rodziny MUST NOT mieć tej możliwości.

#### Scenario: Po dodaniu formy imienia
- **WHEN** admin po dopisaniu formy „Elcia” stuka „Analizuj ponownie” przy wiadomości
- **THEN** wiadomość wraca do analizy i po chwili pojawia się przypisana rzecz do przyniesienia
