# Design

## Decisions

### D1. Wybór per usługa, z konfiguracji
Worker: OpenAI, gdy jest klucz i model analizy OpenAI (wtedy także triaż i kontrola zdjęć idą do OpenAI; bez `OPENAI_TRIAGE_MODEL` działają tylko reguły triażu). API: OpenAI, gdy jest klucz i model asystenta OpenAI. W pozostałych przypadkach Anthropic – brak zmian dla obecnej konfiguracji.

### D2. Bez SDK
Klient na `fetch` z Chat Completions (`tools` + wymuszone `tool_choice`, `max_completion_tokens`, obrazy jako `data:` URL) – mała powierzchnia, łatwa atrapa w testach, brak nowej zależności.

### D3. Te same interfejsy
Implementacje OpenAI realizują `ExtractionModel`, `TriageModel`, `DocumentChecker` i `AssistantModel` z tymi samymi narzędziami (nazwy, schematy) i tymi samymi kodami błędów (odmowa, limit tokenów, brak wywołania), więc dziennik LLM, ponawianie zadań i reguła „odmowa przy zdjęciu = usuń obraz” działają tak samo.

## Risks / Trade-offs

- [Prompt cache] Anthropic ma jawne cache promptu systemowego; OpenAI cache’uje automatycznie dłuższe prefiksy – stała część promptu jest na początku, więc korzyść zostaje.
- [Jakość] Tańszy model może gorzej rozpoznawać sprawy – dziennik LLM i „Analizuj ponownie” pozwalają porównać.
