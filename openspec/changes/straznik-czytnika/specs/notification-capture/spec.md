## ADDED Requirements

### Requirement: Ponowne podłączanie czytnika powiadomień
Aplikacja Android SHALL wykrywać, że system odłączył czytnik powiadomień mimo włączonego dostępu, i podłączać go ponownie: od razu po odłączeniu, przy okresowej synchronizacji, przy otwarciu aplikacji, po restarcie telefonu i po aktualizacji aplikacji. Ekran telefonu SHALL pokazywać, czy czytnik działa.

#### Scenario: Po aktualizacji aplikacji
- **WHEN** aplikacja zaktualizowała się sama, a system nie podłączył czytnika ponownie
- **THEN** aplikacja odnawia podłączenie i kolejne powiadomienia WhatsAppa są zapisywane

#### Scenario: Diagnostyka
- **WHEN** użytkownik otwiera ekran telefonu, a czytnik jest odłączony
- **THEN** widzi „System odłączył czytnik – łączę ponownie”, a po podłączeniu „Czytnik powiadomień działa”
