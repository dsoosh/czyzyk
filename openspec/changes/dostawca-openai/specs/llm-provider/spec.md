# Spec Delta

## Purpose

Pozwala przełączyć dostawcę modeli językowych (Anthropic lub OpenAI) samą konfiguracją.

## ADDED Requirements

### Requirement: OpenAI, gdy skonfigurowany, inaczej Anthropic
Worker SHALL wysyłać analizę wiadomości, triaż i kontrolę zdjęć do OpenAI, gdy ustawiono `OPENAI_API_KEY` i `OPENAI_EXTRACTION_MODEL`, a w przeciwnym razie do Anthropic. API SHALL używać OpenAI dla asystenta, gdy ustawiono `OPENAI_API_KEY` i `OPENAI_CHAT_MODEL`, a w przeciwnym razie Anthropic. Nazwy modeli MUST pochodzić wyłącznie z konfiguracji. Bez żadnego dostawcy worker MUST odmówić startu z komunikatem bez wartości sekretów.

#### Scenario: Przełączenie na OpenAI
- **WHEN** w Railway ustawiono klucz OpenAI i model analizy OpenAI
- **THEN** po wdrożeniu kolejne analizy idą do OpenAI, a dziennik LLM pokazuje nazwę modelu OpenAI

#### Scenario: Bez konfiguracji OpenAI
- **WHEN** zmienne OpenAI nie są ustawione
- **THEN** wszystko działa jak dotąd na modelach Anthropic

### Requirement: Te same zasady u obu dostawców
Implementacje OpenAI SHALL używać tych samych narzędzi i walidacji odpowiedzi co implementacje Anthropic; odmowa, przekroczenie limitu tokenów i brak wywołania narzędzia MUST być obsłużone tak samo (ponowienie zadania, usunięcie obrazu przy odmowie kontroli zdjęcia, wpis w dzienniku LLM).

#### Scenario: Odmowa przy kontroli zdjęcia
- **WHEN** model OpenAI odmawia oceny zdjęcia dokumentu
- **THEN** obraz jest usuwany, a dokument zachowuje tylko tekst
