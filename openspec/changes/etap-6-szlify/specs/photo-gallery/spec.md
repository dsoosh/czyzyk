# Spec Delta

## ADDED Requirements

### Requirement: Album roku
Galeria SHALL dzielić albumy na lata przedszkolne trwające od 1 września do 31 sierpnia (strefa Europe/Warsaw), z przełącznikiem roku i domyślnie bieżącym rokiem.

#### Scenario: Zdjęcia z sierpnia i września
- **WHEN** album ma datę 30 sierpnia 2027, a inny 2 września 2027
- **THEN** pierwszy należy do roku „2026/27”, drugi do „2027/28”

### Requirement: Zaznaczanie do fotoksiążki
Członek rodziny SHALL móc zaznaczać pojedyncze zdjęcia lub całe albumy do fotoksiążki danego roku; zaznaczenia MUST być wspólne dla całej rodziny i widoczne z licznikiem.

#### Scenario: Wspólne zaznaczenia
- **WHEN** Ola zaznacza 12 zdjęć do fotoksiążki 2026/27
- **THEN** Darek widzi te same 12 zdjęć jako zaznaczone i licznik „12 do fotoksiążki”

### Requirement: Pobranie oryginałów
Członek rodziny SHALL móc pobrać zaznaczone zdjęcia roku jako plik ZIP z oryginałami, nazwanymi datą i albumem, w kolejności chronologicznej. Osoba spoza rodziny MUST NOT móc wygenerować pobrania.

#### Scenario: Pobranie ZIP
- **WHEN** użytkownik stuka „Pobierz oryginały (12)”
- **THEN** pobiera plik ZIP z 12 oryginałami o nazwach w formacie `2026-10-09_jezyki-z-kasztanow_01.jpg`

#### Scenario: Osoba spoza rodziny
- **WHEN** sesja bez profilu rodziny żąda pobrania ZIP
- **THEN** żądanie jest odrzucone
