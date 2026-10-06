## ADDED Requirements

### Requirement: Znormalizowane nazwy grup
System SHALL zapisywać i porównywać nazwy grup w postaci znormalizowanej (Unicode NFC, bez niewidocznych znaków formatujących, z pojedynczymi spacjami), na telefonie i na serwerze. Dwie nazwy różniące się tylko tymi szczegółami MUST oznaczać tę samą grupę.

#### Scenario: Nazwa z niewidocznymi znakami
- **WHEN** powiadomienie podaje nazwę grupy „SOKOŁY - Cztery Żywioły” otoczoną znakami U+2068/U+2069
- **THEN** wiadomość trafia do istniejącej śledzonej grupy „SOKOŁY - Cztery Żywioły”, a nie do nowej

#### Scenario: Istniejące duplikaty
- **WHEN** w bazie są dwie grupy o tej samej znormalizowanej nazwie, jedna śledzona
- **THEN** po migracji zostaje jedna, śledzona grupa z wiadomościami i elementami obu
