# Spec Delta

## Purpose

Wiadomość wklejona ręcznie przez rodzinę zawsze trafia do pełnej analizy.

## ADDED Requirements

### Requirement: Wklejona wiadomość zawsze analizowana
Paczka zawierająca wiadomość wklejoną ręcznie SHALL trafiać do pełnej analizy bez reguł pogawędki i bez wstępnej oceny modelu. W prompcie analizy taka wiadomość SHALL mieć znacznik „[wklejona ręcznie]”. Analiza MUST NOT pomijać jej jako duplikatu wcześniejszej, uciętej wiadomości. Brakujące informacje SHALL tworzyć nowe elementy albo uzupełniać istniejące.

#### Scenario: Ucięte powiadomienie i wklejona pełna treść
- **WHEN** powiadomienie ucięło wiadomość „Zebranie w czwartek o 17, prosimy o…”, a rodzina wkleja pełną treść ze składką 50 zł do piątku
- **THEN** wklejona wiadomość trafia do pełnej analizy z pominięciem triażu, a analiza dodaje płatność 50 zł
