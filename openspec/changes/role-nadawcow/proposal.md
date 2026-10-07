# Proposal

## Why

W wiadomościach z grup nie widać, kto pisze: nauczycielka („ciocia”), dyrekcja, inny rodzic czy ktoś z naszej rodziny. Autorzy to często same numery telefonów. Analiza nie odróżnia własnych wiadomości rodziny ani wiadomości skierowanych do niej (wzmianka @numer).

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** admin przypisuje autorom role, każdy członek rodziny wskazuje swój numer, a historia grup, analiza i asystent oznaczają wiadomości od i do rodziny.

## What Changes

- Admin → **Kontakty**: autorzy ze śledzonych grup (pisownie jednego numeru połączone), rola (ciocia, dyrekcja, rodzic, nasza rodzina) i opis (np. „Ciocia Ania (Sokoły)”).
- Ustawienia → **Mój numer WhatsApp**: członek rodziny zapisuje swój numer (rola „nasza rodzina”).
- Historia grupy: znacznik roli przy autorze, wyróżnienie wiadomości rodziny i wiadomości „do Was” (wzmianka o numerze lub imieniu z rodziny).
- Analiza wiadomości: znaczniki `[ciocia]`, `[dyrekcja]`, `[rodzic]`, `[nasza rodzina]`, `[do nas]` przy autorze i reguła 14 w domyślnym prompcie (z własnych wiadomości rodziny nie powstają zadania dla niej).
- Asystent: te same znaczniki w historii grup.

**Poza zakresem:** import kontaktów z telefonu, automatyczne rozpoznawanie ról.

## Capabilities

### New Capabilities

- `contact-roles`: role autorów wiadomości i numery członków rodziny.

### Modified Capabilities

(brak – domyślny prompt analizy rozszerzony w `llm-prompts`, zmiana niezarchiwizowana)

## Impact

- Migracja `0015_contact_roles.sql` (tabela `contact_roles`, `list_message_authors`, `admin_save_contact_role`, `set_my_phone`).
- `packages/shared/src/contacts.ts` (normalizacja autorów, role, wzmianki), `services/worker`, `services/api`, `apps/pwa`, `.railway/railway.ts`.
- Zależy od zmiany `prompty-llm` (domyślne prompty w `@czyzyk/shared/prompts`).
