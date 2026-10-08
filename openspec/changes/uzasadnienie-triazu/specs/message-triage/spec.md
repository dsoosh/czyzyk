# Spec Delta

## Purpose

Dodaje do wstępnej oceny modelu krótkie uzasadnienie.

## ADDED Requirements

### Requirement: Uzasadnienie wstępnej oceny
Wstępna ocena modelu SHALL zwracać, obok oceny, jedno krótkie zdanie po polsku z uzasadnieniem. Uzasadnienie SHALL trafiać do dziennika wywołań modelu i być widoczne dla adminów na liście wywołań oraz w szczegółach wiadomości. Brak uzasadnienia MUST NOT unieważniać oceny.

#### Scenario: Pominięte podziękowania
- **WHEN** model ocenia „Dziękujemy za piękne zdjęcia z wycieczki” jako nieistotne
- **THEN** w szczegółach wiadomości admin widzi „Wstępna ocena: pominięte” i uzasadnienie modelu, np. „Same podziękowania, bez spraw organizacyjnych.”
