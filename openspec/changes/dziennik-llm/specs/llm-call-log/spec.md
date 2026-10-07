# Spec Delta

## Purpose

Pozwala adminowi zobaczyć zapytania wysyłane do modelu językowego przy analizie wiadomości i odpowiedzi modelu.

## ADDED Requirements

### Requirement: Dziennik wywołań modelu przy analizie
Każde wywołanie modelu przy analizie wiadomości (udane i nieudane) SHALL zostawić wpis z czasem, grupą, modelem, zapytaniem (prompt systemowy i treść), odpowiedzią (operacje albo kod błędu), zużyciem tokenów i czasem trwania. Wpisy starsze niż 14 dni MUST być usuwane. Błąd zapisu wpisu MUST NOT przerywać analizy.

#### Scenario: Udana analiza
- **WHEN** worker analizuje nowe wiadomości grupy
- **THEN** powstaje wpis z treścią zapytania i listą operacji zwróconych przez model

#### Scenario: Błąd modelu
- **WHEN** model nie zwraca poprawnej odpowiedzi
- **THEN** powstaje wpis z zapytaniem i kodem błędu

### Requirement: Podgląd tylko dla admina
Dziennik SHALL być widoczny w panelu admina (Admin → LLM) jako lista od najnowszych z podglądem zapytania i odpowiedzi. Członek rodziny i osoba spoza rodziny MUST NOT móc go odczytać. Rozmowy z asystentem MUST NOT trafiać do dziennika.

#### Scenario: Członek rodziny
- **WHEN** użytkownik z rolą `family` czyta tabelę dziennika
- **THEN** dostaje pusty wynik
