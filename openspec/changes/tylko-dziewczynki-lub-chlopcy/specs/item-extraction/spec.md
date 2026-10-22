# Spec Delta

## ADDED Requirements

### Requirement: Sprawy tylko dla dziewczynek albo chłopców
Analiza SHALL przypisywać prośbę lub informację skierowaną tylko do dziewczynek albo tylko do chłopców wyłącznie dzieciom tej płci z rodzin w grupie (płeć rozpoznana po imieniu). Gdy w grupie nie ma dziecka tej płci, element MUST NOT powstać.

#### Scenario: Spódnica dla dziewczynek
- **WHEN** w grupie są Elena i Wicek, a wiadomość mówi „Dziewczynki potrzebują spódnicy, więc jest mile widziana”
- **THEN** powstaje rzecz do przyniesienia „spódnica” tylko dla Eleny, a rodzina Wicka jej nie widzi

#### Scenario: Sami chłopcy
- **WHEN** w grupie z rodzin korzystających z aplikacji jest tylko Wicek
- **THEN** wiadomość o spódnicy dla dziewczynek nie tworzy elementu
