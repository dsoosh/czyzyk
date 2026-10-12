## Purpose

Dzieci dopisane przez analizę zostają przy sprawie, a „Wymaga odpowiedzi” ma jedną akcję.

## ADDED Requirements

### Requirement: Adresaci z analizy przy starych sprawach
Gdy analiza dopisuje albo zmienia adresatów starej sprawy (`join`, `update`), te imiona SHALL zastąpić adresatów liczonych z treści wiadomości. Późniejsze przeliczenie MUST NOT ich nadpisywać.

#### Scenario: Dziecko z innej grupy dołączone do wydarzenia
- **WHEN** analiza grupy Wilki dołącza Florka do starego wydarzenia grupy Sowy przypisanego do innego dziecka
- **THEN** wydarzenie ma przypisane oba dzieci i widzi je rodzina Florka

### Requirement: Dzieci grup dołączonych
PWA SHALL pokazywać przy sprawie bez adresatów dzieci rodziny z głównej grupy sprawy i z grup dołączonych. Sprawa bez adresatów MUST NOT trzymać starego przypisania do dzieci.

#### Scenario: Wspólna wycieczka dwóch grup
- **WHEN** wycieczka grupy Sowy ma dołączoną grupę Wilki i nie ma adresatów
- **THEN** przy wycieczce widać dzieci rodziny z obu grup

### Requirement: Wymaga odpowiedzi bez proponowanych akcji
Sprawa „wymaga odpowiedzi” SHALL mieć jedną akcję: „Oznacz jako wykonane”. Analiza MUST NOT tworzyć proponowanych akcji.

#### Scenario: Zamknięcie sprawy
- **WHEN** rodzina stuka „Oznacz jako wykonane” przy sprawie
- **THEN** sprawa jest zamknięta dla tej rodziny i trafia do „Załatwione”
