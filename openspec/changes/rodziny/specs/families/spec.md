# Spec Delta

## Purpose

Wiele rodzin w jednej aplikacji: każda widzi grupy swoich dzieci i grupy wspólne, a stan „zrobione” ma osobno.

## ADDED Requirements

### Requirement: Rodzina jako właściciel dostępu
Każdy profil, adres z listy dozwolonych i dziecko SHALL należeć do jednej rodziny. Dzieci, profile i role kontaktów „rodzina” MUST być widoczne tylko dla członków tej samej rodziny. Operator (admin) SHALL widzieć wszystkie dane. Imię, inne formy imienia i kolor dziecka SHALL być unikalne w obrębie rodziny. Adres dodany bez wskazania rodziny SHALL trafić do pierwszej rodziny.

#### Scenario: Dwie rodziny
- **WHEN** rodzina A ma dziecko Zosia, a rodzina B dziecko o tym samym imieniu
- **THEN** obie zapisują się bez konfliktu, a każda rodzina widzi tylko swoje dziecko

### Requirement: Widoczność według grup dzieci
Członek rodziny SHALL widzieć grupę oraz jej wiadomości, załączniki, elementy i historię zmian tylko wtedy, gdy grupa jest oznaczona jako wspólna albo chodzi do niej dziecko jego rodziny. Elementy bez grupy (całe przedszkole) SHALL być widoczne dla każdej rodziny. Ograniczenie MUST być egzekwowane w bazie (RLS i funkcje RPC). Listę śledzonych grup do wyboru grupy dziecka SHALL zwracać osobna funkcja.

#### Scenario: Grupa cudzego dziecka
- **WHEN** córka koleżanki chodzi do grupy Wilki, a dzieci użytkownika nie
- **THEN** koleżanka widzi wiadomości i wydarzenia Wilków, a pozostali członkowie innych rodzin nie

#### Scenario: Grupa wspólna
- **WHEN** operator zaznacza grupę „Ogłoszenia przedszkola” jako wspólną
- **THEN** każda rodzina widzi jej wiadomości i elementy, niezależnie od dzieci

### Requirement: Stan „zrobione” osobno dla rodziny
Znaczniki „spakowane”, „zapłacone” i „odpowiedziane” (z wybraną akcją) SHALL być zapisywane osobno dla każdej rodziny. Oznaczenie przez jedną rodzinę MUST NOT zmieniać stanu u innej. Skróty, alerty, subskrypcja kalendarza i asystent SHALL liczyć treść według widoczności i stanu rodziny użytkownika.

#### Scenario: Płatność w dwóch rodzinach
- **WHEN** rodzina A oznacza wspólną płatność „Teatrzyk 20 zł” jako zapłaconą
- **THEN** u rodziny B płatność dalej jest otwarta i pojawia się w jej skrócie

### Requirement: Grupa wspólna w panelu grup
Panel grup operatora SHALL mieć przy każdej grupie znacznik „Wspólna” obok „Śledź”. Zmieniać go MUST wyłącznie admin.

#### Scenario: Zaznaczenie
- **WHEN** operator zaznacza „Wspólna” przy grupie
- **THEN** grupa jest od razu widoczna dla wszystkich rodzin

### Requirement: Dodanie i usunięcie dziecka
Dodanie dziecka do grupy SHALL od razu pokazać rodzinie istniejące wiadomości i sprawy tej grupy. Usunięcie dziecka albo przeniesienie go do innej grupy SHALL:
- usunąć je z przypisań przy sprawach;
- gdy rodzina przestaje widzieć grupę, usunąć jej stan „zrobione” i sprawy utworzone z jej wyborów w tej grupie.

Stan innych rodzin MUST pozostać bez zmian.

#### Scenario: Usunięcie jedynego dziecka z grupy
- **WHEN** rodzina usuwa dziecko z grupy Wilki, a innego dziecka tam nie ma
- **THEN** sprawy Wilków znikają z jej widoku, a jej znaczniki „zapłacone” w Wilkach są usunięte; znaczniki innej rodziny zostają
