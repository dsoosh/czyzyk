# Design

## Decisions

### D1. Klucz autora
`normalizeAuthor()` (wspólny dla PWA, workera i API): numer w dowolnej pisowni („+48 535 111 213”, „0048…”, „535 111 213”) → `+48535111213` (9 cyfr = numer polski); nazwa → małe litery, pojedyncze spacje, bez „~ ” WhatsAppa i niewidocznych znaków. Baza przechowuje gotowe klucze; normalizacja tylko w TypeScripcie, żeby nie utrzymywać dwóch implementacji.

### D2. Role ustawiane przez rodzinę
`contact_roles(author_key, role, label, profile_id)`: odczyt dla rodziny, zapis przez RPC – admin dowolnego autora (`admin_save_contact_role`), członek rodziny tylko swój numer (`set_my_phone`, rola „rodzina”, jeden numer na osobę). Lista autorów (`list_message_authors`) działa z RLS wywołującego i tylko dla śledzonych grup.

### D3. „Do nas” = wzmianka
Wiadomość jest „do nas”, gdy zawiera `@` z numerem członka rodziny (WhatsApp wstawia wzmianki jako `@48535…`) albo `@` z nazwą/opisem autora o roli „nasza rodzina”. Wiadomość samej rodziny nie jest oznaczana jako „do nas”.

### D4. Znaczniki w danych, nie w instrukcjach
Znaczniki trafiają do linii wiadomości (tura użytkownika) obok autora; ich znaczenie opisuje reguła 14 w domyślnym prompcie analizy i jedna linia w prompcie asystenta. Rola pochodzi od rodziny (zaufana), treść wiadomości pozostaje niezaufana.

## Risks / Trade-offs

- Ta sama osoba bywa widoczna raz jako numer, raz jako nazwa – trzeba przypisać rolę obu pisowniom.
- Wzmianka po imieniu („@Darek”) może się pomylić z innym Darkiem w grupie – akceptowalne dla oznaczenia pomocniczego.
