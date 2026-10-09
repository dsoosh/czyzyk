# Proposal

## Why

Czyżyk zakłada jedną rodzinę: każdy zalogowany widzi wszystko, a znaczniki „zapłacone”, „spakowane” i „odpowiedziane” są wspólne. Użytkownik chce, żeby z aplikacji korzystały też inne rodziny, np. koleżanka, której córka chodzi do śledzonej grupy. Każda rodzina ma widzieć tylko grupy swoich dzieci i grupy wspólne dla wszystkich. Telefon z Czyżyk Connect, śledzenie grup i panel admina zostają wyłącznie u operatora (właściciela).

To pierwsza z trzech zmian:
1. `rodziny` (ta): fundament danych i dostępu.
2. `analiza-dwuetapowa`: elementy grupy liczone raz, przypisanie dzieci osobno dla każdej rodziny, niższy koszt.
3. `dolaczanie-rodzin`: prośby o dostęp, akceptacja przez operatora, panel rodziny.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** dane mają właściciela-rodzinę, dostęp w bazie wynika z dzieci rodziny i grup wspólnych, stan „zrobione” jest osobny dla każdej rodziny, a obecne dane działają bez zmian w jednej rodzinie.

## What Changes

- **Rodziny w bazie:**
  - tabela `families`;
  - `family_id` przy profilach, adresach z listy dozwolonych i dzieciach;
  - obecne dane trafiają do jednej rodziny;
  - nowy adres bez wskazanej rodziny trafia do pierwszej rodziny (zachowanie do czasu zmiany `dolaczanie-rodzin`).
- **Grupy wspólne:** znacznik `wa_groups.shared` („Wspólna”) obok „Śledź” w panelu grup. Grupę wspólną widzi każda rodzina. Migracja oznacza jako wspólne śledzone grupy, do których nie chodzi żadne dziecko, żeby obecna rodzina dalej je widziała.
- **Widoczność:**
  - rodzina widzi grupę, gdy jest wspólna albo chodzi do niej jej dziecko;
  - elementy całego przedszkola (bez grupy) widzi każda rodzina;
  - dotyczy to grup, wiadomości, załączników, elementów (wydarzenia, rzeczy, płatności, sprawy, dni wolne, fakty) i historii zmian;
  - operator (admin) widzi wszystko.
- **Dzieci, profile i kontakty:**
  - dzieci i profile są widoczne tylko w obrębie rodziny;
  - imiona i kolory dzieci są unikalne w rodzinie, a nie globalnie;
  - role kontaktów „rodzina” innych rodzin są niewidoczne.
- **Wybór grupy dziecka:** RPC `trackable_groups()` podaje listę śledzonych grup, z której rodzina wybiera grupę dziecka.
- **Stan „zrobione” per rodzina:**
  - tabela `item_done` zastępuje kolumny `packed_*`, `paid_*`, `resolved_*` i `resolution`;
  - PWA czyta elementy przez widoki `family_bring_items`, `family_payments` i `family_action_required`, które dokładają stan rodziny;
  - `mark_packed`, `mark_paid`, `mark_resolved` i `apply_action_suggestion` piszą stan rodziny wywołującego.
- **Serwer:**
  - wieczorny i poranny skrót, alerty, subskrypcja kalendarza i asystent liczą treść dla rodziny użytkownika;
  - kontekst analizy nie zależy już od stanu „zrobione”.
- **Kontekst projektu:** `openspec/config.yaml` opisuje wiele rodzin zamiast jednej.

**Poza zakresem:**
- analiza dwuetapowa i przypisanie dzieci innych rodzin (zmiana 2);
- przeliczenie przypisań istniejących spraw do imion po dodaniu dziecka (zmiana 2; tu dodanie dziecka od razu pokazuje sprawy jego grupy, a usunięcie sprząta stan rodziny).
- samodzielne dołączanie i panel rodziny (zmiana 3).

## Capabilities

### New Capabilities

- `families`: rodziny, widoczność danych według dzieci i grup wspólnych, stan „zrobione” per rodzina.

### Modified Capabilities

(brak)

## Impact

- Baza: migracja `0032_families.sql`, testy izolacji `supabase/tests/families.test.ts`.
- PWA:
  - `lib/items.ts`, `lib/tracking.ts`;
  - wybór grupy dziecka;
  - checkbox „Wspólna” w `GroupsPage`;
  - testowy fake (aliasy widoków).
- Worker: `push/digest.ts`, `push/alerts.ts`, filtry kontekstu w `extraction/batch.ts`.
- API: `ical/routes.ts`, `assistant/context.ts`.
