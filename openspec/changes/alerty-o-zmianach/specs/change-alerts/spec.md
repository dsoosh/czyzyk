# Spec Delta

## Purpose

Rodzina dowiaduje się od razu, gdy w przedszkolu pojawia się lub zmienia coś, co jej dotyczy.

## ADDED Requirements

### Requirement: Alert o nowym, zmienionym i odwołanym wydarzeniu
System SHALL wysyłać alert push natychmiast po analizie, która utworzyła aktywne wydarzenie, zmieniła jego pola albo je odwołała. Każda zapisana zmiana MUST wywołać najwyżej jeden alert. Aktualizacja bez zmiany pól, dołączenie grupy do wspólnego wydarzenia, stałe zajęcia w godzinach przedszkola i wydarzenia minione MUST NOT wywoływać alertu.

#### Scenario: Nowa wycieczka
- **WHEN** analiza tworzy wydarzenie „Wycieczka do muzeum” 15.10 o 8:30
- **THEN** członkowie rodzin, które je widzą, z włączonym alertem o wydarzeniach dostają „Nowe wydarzenie: Wycieczka do muzeum (15.10 8:30)”

#### Scenario: Zmiana terminu
- **WHEN** kolejna wiadomość przesuwa termin wycieczki
- **THEN** przychodzi „Zmiana w wydarzeniu: Wycieczka do muzeum (…) (termin)”, a ponowne przetworzenie tej samej zmiany nie wysyła drugiego alertu

#### Scenario: Przypomnienie bez zmian
- **WHEN** wiadomość tylko przypomina o wydarzeniu i nie zmienia żadnego pola
- **THEN** alert nie jest wysyłany

### Requirement: Alert o nowej rzeczy do przyniesienia
System SHALL wysyłać alert push, gdy analiza tworzy aktywną rzecz do przyniesienia z terminem nie wcześniejszym niż dziś albo bez terminu. Ta sama rzecz MUST NOT wywołać tego alertu więcej niż raz.

#### Scenario: Strój na bal
- **WHEN** analiza tworzy rzecz „strój na bal” na 10.10
- **THEN** przychodzi „Do przyniesienia: strój na bal (na 10.10)”

### Requirement: Ustawienia nowych alertów
Członek rodziny SHALL móc osobno wyłączyć alerty o wydarzeniach i o rzeczach do przyniesienia; oba MUST być domyślnie włączone.

#### Scenario: Wyłączone alerty o wydarzeniach
- **WHEN** użytkownik wyłącza „Alert: nowe, zmienione i odwołane wydarzenia”
- **THEN** nie dostaje alertów o wydarzeniach, a alerty o rzeczach do przyniesienia i sprawach do decyzji nadal przychodzą
