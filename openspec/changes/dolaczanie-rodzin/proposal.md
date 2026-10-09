# Proposal

## Why

Logowanie z adresu spoza listy dozwolonych jest dziś odrzucane przez hook Supabase Auth i nie zostawia śladu. Operator nie dowiaduje się, że ktoś chciał dołączyć, a rodzina nie może sama dodać drugiego rodzica. Użytkownik zgłosił, że nie dostaje powiadomień o osobach czekających na autoryzację.

Trzecia z trzech zmian (po `rodziny` i `analiza-dwuetapowa`). Zmiana na prośbę użytkownika. **Gotowe, gdy:**
- logowanie z nieznanego adresu zapisuje prośbę o dostęp;
- operator dostaje powiadomienie push i akceptuje albo odrzuca prośbę w panelu admina;
- rodzina sama dodaje i usuwa adresy swoich członków.

## What Changes

- **Prośby o dostęp:**
  - hook przyjmuje każde konto Google, ale profil powstaje tylko dla adresu z listy dozwolonych;
  - konto spoza listy zapisuje prośbę w nowej tabeli `access_requests`;
  - konto bez profilu nadal nie ma dostępu do żadnych danych (RLS przez `is_family()`).
- **PWA dla czekającego:** ekran „Czekasz na akceptację” zamiast „Brak dostępu”, z przyciskiem sprawdzenia ponownie i wylogowania; po odrzuceniu ekran mówi, że prośba została odrzucona.
- **Powiadomienie operatora:** worker co 5 minut wysyła adminom push o nowych prośbach (adres e-mail i imię), każdą prośbę jeden raz.
- **Panel admina:**
  - lista próśb na stronie „Dostęp”;
  - „Akceptuj” tworzy nową rodzinę i dopisuje adres;
  - „Odrzuć” zamyka prośbę bez kolejnych powiadomień.
- **Panel rodziny w ustawieniach („Moja rodzina”):**
  - lista członków rodziny (adresy, imię po pierwszym logowaniu);
  - dodanie adresu członka bez udziału operatora; adres z prośbą o dostęp od razu dostaje profil w tej rodzinie;
  - usunięcie członka (nie siebie i nie admina).

**Poza zakresem:** zmiana nazwy rodziny, przenoszenie członka między rodzinami przez rodzinę (robi to operator).

## Capabilities

### New Capabilities

- `families-joining`: prośby o dostęp, powiadomienie i akceptacja przez operatora, panel członków rodziny.

### Modified Capabilities

(brak)

## Impact

- Baza: migracja `0034_access_requests.sql`, test `supabase/tests/access-requests.test.ts`.
- Worker: `push/access.ts`, wywołanie w zadaniu skrótów.
- PWA: `AuthProvider`, `NoAccessPage`, `AllowedEmailsPage`, nowa sekcja `FamilySection`.
