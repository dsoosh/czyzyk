# Proposal

## Why

Po zmianie `dolaczanie-rodzin` każda zaakceptowana osoba dostaje własną rodzinę. Gdy drugi rodzic założył konto osobno, rodzina nie może go dodać: `family_add_member` odrzuca adres należący do innej rodziny. Użytkownik chce, żeby taka osoba dostała zaproszenie („Ola zaprasza Cię do rodziny”) i po jego przyjęciu przeszła do rodziny zapraszającego.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** rodzina zaprasza adres z innej rodziny, zaproszony dostaje push i widzi zaproszenie w aplikacji, a po przyjęciu należy do nowej rodziny razem ze swoimi danymi, jeśli był w starej rodzinie sam.

## What Changes

- **Zaproszenia w bazie:**
  - tabela `family_invites`;
  - `family_add_member` dla adresu z innej rodziny tworzy zaproszenie i zwraca `invited`, a dla nowego adresu dodaje go od razu i zwraca `added`;
  - `family_members` pokazuje też wysłane zaproszenia;
  - `family_remove_member` anuluje wysłane zaproszenie.
- **Decyzja zaproszonego:**
  - `my_family_invites()` zwraca zaproszenia dla adresu zalogowanego;
  - `accept_family_invite(id)` przenosi adres do rodziny zapraszającego;
  - `decline_family_invite(id)` usuwa zaproszenie.
- **Scalenie rodzin:** gdy zaproszony był jedyną osobą w starej rodzinie, jego dzieci, znaczniki „zrobione” i sprawy rodziny przechodzą do nowej rodziny, a stara rodzina znika. Dziecko o tym samym imieniu co dziecko nowej rodziny nie jest dublowane. Gdy w starej rodzinie zostają inne osoby, przechodzi tylko zaproszony.
- **Powiadomienie:** worker co 5 minut wysyła zaproszonemu push „Zaproszenie do rodziny”, raz na zaproszenie.
- **PWA:**
  - baner zaproszenia na ekranie „Dziś” z przyciskami „Dołącz” i „Odrzuć”;
  - w „Moja rodzina” zaproszenia mają status „zaproszenie wysłane”.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `families-joining`: zaproszenia do rodziny dla osób z innej rodziny.

## Impact

- Baza: migracja `0035_family_invites.sql`, test `supabase/tests/family-invites.test.ts`.
- Worker: `push/access.ts` (zaproszenia), test w `cron.db.test.ts`.
- PWA: `TodayPage` (baner), `FamilySection`.
