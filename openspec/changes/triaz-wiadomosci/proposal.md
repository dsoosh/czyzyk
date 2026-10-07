# Proposal

## Why

Każda paczka nowych wiadomości idzie dziś do pełnej analizy: prompt systemowy (z cache), 50 wcześniejszych wiadomości, lista spraw i nowe wiadomości – kilka tysięcy tokenów, także dla „Dziękuję!” i „👍”. Większość ruchu w grupach to pogawędka. Użytkownik zaproponował prosty triaż przed analizą, żeby obciąć koszty.

## What Changes

- `services/worker`: przed pełną analizą paczki:
  - reguły (za darmo): paczka złożona wyłącznie z pogawędki (reakcje, grzeczności, zdjęcie bez podpisu i bez dokumentu) jest oznaczana jako przetworzona bez modelu; wiadomości od rodziny, ze wzmianką o rodzinie, z cyframi lub pytaniem nigdy nie są pogawędką;
  - tani model (opcjonalny, `TRIAGE_MODEL`): krótkie pytanie (otwarte sprawy, 5 wcześniejszych i nowe wiadomości) „czy to może tworzyć lub zmieniać sprawy?”; „nie” → paczka pominięta; błąd lub brak odpowiedzi → pełna analiza.
- Dziennik: `sync_log` ze statusem `skipped` (liczba wiadomości, który próg), wywołanie triażu w dzienniku LLM admina (rodzaj `triage`).
- PWA: Admin → LLM pokazuje wstępną ocenę; historia grupy pokazuje adminowi znacznik przy wiadomościach pominiętych przez triaż.

## Capabilities

### New Capabilities

- `message-triage`: wstępna ocena paczki wiadomości przed pełną analizą.

### Modified Capabilities

(brak)

## Impact

- Migracja `0020_message_triage.sql` (rodzaj `triage` w `llm_calls`); `.railway/railway.ts`: `TRIAGE_MODEL`.
