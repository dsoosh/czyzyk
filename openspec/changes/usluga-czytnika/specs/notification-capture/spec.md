## ADDED Requirements

### Requirement: Stała usługa chroniąca czytnik
Aplikacja Android SHALL działać jako usługa pierwszoplanowa z cichym, stałym powiadomieniem, gdy użytkownik jej nie wyłączył i dostęp do powiadomień jest włączony. Usługa SHALL co kilka minut sprawdzać, czy czytnik powiadomień jest podłączony, i podłączać go ponownie. Usługa MUST być domyślnie włączona i dać się wyłączyć na ekranie telefonu.

#### Scenario: Telefon leży kilka godzin z wygaszonym ekranem
- **WHEN** telefon długo nie jest używany
- **THEN** proces Czyżyk Connect nadal działa, a powiadomienia WhatsAppa z tego czasu są zapisywane

#### Scenario: Użytkownik wyłącza ochronę
- **WHEN** użytkownik wyłącza „Stała ochrona czytnika”
- **THEN** stałe powiadomienie znika, a usługa nie uruchamia się ponownie
