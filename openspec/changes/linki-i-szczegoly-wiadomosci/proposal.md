# Proposal

## Why

Linki w wiadomościach (formularze zapisów, filmy, strony wycieczek) są dziś zwykłym tekstem: nie da się ich kliknąć, a długie adresy zasłaniają treść. W widoku czatu nie widać też, co stało się z konkretną wiadomością: czy wstępna ocena ją pominęła, czy była analizowana i jakie sprawy z niej powstały.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** linki w wiadomościach są klikalne i mają krótką nazwę, a kliknięcie wiadomości w czacie pokazuje werdykt analizy, sprawy z niej i (dla admina) wywołania modelu.

## What Changes

- PWA, linki w treści wiadomości (historia grupy, „skąd to wiem”, historia wydarzenia):
  - klikalne linki `http`/`https` i adresy zaczynające się od `www.`;
  - krótka nazwa zamiast adresu („🔗 YouTube”, „🔗 Formularz Google”, „🔗 wroclaw.pl/…”), pełny adres w podpowiedzi;
  - otwierane poza aplikacją z `rel="noopener noreferrer nofollow"`; inne schematy, np. `javascript:`, nie są linkowane.
- PWA, kliknięcie wiadomości w czacie rozwija szczegóły:
  - werdykt: czeka na analizę, pominięta (reguły lub wstępna ocena), przeanalizowana;
  - sprawy, które wiadomość utworzyła, zmieniła albo odwołała, z linkami do wydarzenia lub do „skąd to wiem”;
  - dla admina wywołania modelu (wstępna ocena, analiza, kontrola zdjęcia) z linkiem do wpisu w Admin → LLM (`?wywolanie=`).
- Migracja `0028_llm_call_messages`: `llm_calls.message_ids`. Worker zapisuje tam wiadomości, których dotyczyło wywołanie.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `group-history`: klikalne linki i szczegóły wiadomości.
- `llm-call-log`: wywołanie zna swoje wiadomości; pojedyncze wywołanie pod adresem z `?wywolanie=`.

## Impact

- Baza: migracja `0028_llm_call_messages` (kolumna i indeks; RLS bez zmian: odczyt tylko dla admina).
- Worker: `llmLog.ts`, `run.ts`, `documents.ts`.
- PWA: `lib/links.ts`, `MessageText`, `MessageDetailsPanel`, `lib/messageDetails.ts`, `GroupHistoryPage`, `LlmCallsPage`, `SourcePage`, `EventHistory`.
