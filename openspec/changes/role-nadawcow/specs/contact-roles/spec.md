## ADDED Requirements

### Requirement: Role autorów wiadomości
Admin SHALL móc przypisać autorowi wiadomości (numerowi lub nazwie z grup) rolę „ciocia”, „dyrekcja”, „rodzic” albo „nasza rodzina” oraz opis. Różne pisownie tego samego numeru MUST wskazywać tę samą rolę. Członkowie rodziny SHALL widzieć role; zmieniać je MAY tylko admin.

#### Scenario: Nauczycielka pod numerem
- **WHEN** admin nadaje numerowi „+48 535 111 213” rolę „ciocia” z opisem „Ciocia Ania (Sokoły)”
- **THEN** jej wiadomości w historii grupy mają znacznik „Ciocia Ania (Sokoły)”, a analiza widzi przy nich `[ciocia]`

### Requirement: Własny numer członka rodziny
Każdy członek rodziny SHALL móc wskazać w Ustawieniach swój numer WhatsApp; wiadomości z tego numeru MUST być oznaczone jako „nasza rodzina”. Wpis, który nie jest numerem telefonu, MUST zostać odrzucony.

#### Scenario: Moje wiadomości
- **WHEN** Ola zapisuje swój numer, a w grupie jest jej wiadomość „Przyniosę kasztany”
- **THEN** wiadomość jest wyróżniona jako „nasza rodzina”, a analiza nie tworzy z niej zadania dla rodziny

### Requirement: Wiadomości skierowane do rodziny
Wiadomość innej osoby zawierająca wzmiankę o numerze lub imieniu członka rodziny SHALL być oznaczona jako skierowana do rodziny („do Was” w historii, `[do nas]` w analizie).

#### Scenario: Wzmianka
- **WHEN** inny rodzic pisze „@48535111213 weźmiesz klucze?”, a to numer Darka z rodziny
- **THEN** wiadomość ma oznaczenie „do Was”
