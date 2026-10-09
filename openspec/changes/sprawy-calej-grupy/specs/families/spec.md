## Purpose

Sprawy całej grupy zapisane przed analizą dwuetapową są widoczne dla wszystkich rodzin grupy.

## ADDED Requirements

### Requirement: Stare sprawy całej grupy
Sprawa zapisana przed analizą dwuetapową, której adresatami są wszystkie dzieci operatora z grup tej sprawy, SHALL być traktowana jako sprawa całej grupy. Każda rodzina z dzieckiem w tej grupie SHALL ją widzieć.

#### Scenario: Nowa rodzina dodaje dziecko
- **WHEN** w grupie Wilki jest stare wydarzenie przypisane do jedynego dziecka operatora w tej grupie, a nowa rodzina dodaje dziecko w grupie Wilki
- **THEN** nowa rodzina widzi to wydarzenie
