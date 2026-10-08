# Spec Delta

## Purpose

Łączy istniejące w bazie sąsiednie dni wolne w jeden zakres.

## ADDED Requirements

### Requirement: Sąsiednie dni wolne połączone w bazie
Migracja SHALL połączyć aktywne dni wolne tej samej grupy i o tym samym powodzie, przypadające na kolejne dni lub rozdzielone tylko weekendem, w jeden dzień wolny od–do. Zostaje najwcześniejszy z nich, z wiadomościami źródłowymi wszystkich połączonych. Pozostałe MUST zostać odwołane, a nie usunięte. Każda zmiana SHALL trafić do historii elementu.

#### Scenario: Ferie wpisane dzień po dniu
- **WHEN** w bazie są dni wolne „ferie” grupy Motylki na czwartek 12.02, piątek 13.02 i poniedziałek–środę 16–18.02
- **THEN** po migracji jest jeden aktywny dzień wolny 12.02–18.02, a pozostałe dwa są odwołane z wpisem w historii
