# Design

## Decisions

### D1. Opis jako tekst, nie model danych
Informacje o placówce są różnorodne (miejsca, osoby, grupy, kanały) i zmieniają się rzadko. Jeden tekst (do 8000 znaków), edytowany przez admina, wystarcza modelowi i nie wymaga migracji przy każdej zmianie. Tabela ma jeden wiersz (`id boolean primary key default true check (id)`).

### D2. Kontekst od rodziny, nie z grup
Opis pochodzi od admina rodziny, nie z wiadomości grup, więc w prompcie ekstrakcji jest osobnym blokiem `<przedszkole>` przed danymi z grup, z zasadą, że opisuje placówkę. Wiadomości nadal są oznaczone jako niezaufane. W asystencie trafia na początek danych widoku jako sekcja „O przedszkolu”.

### D3. Dostęp
Odczyt dla rodziny (RLS `family_read`), zapis wyłącznie przez `admin_update_kindergarten_profile` (`security definer`, `is_admin()`), jak inne RPC admina.

## Risks / Trade-offs

- Dłuższy prompt ekstrakcji (kilkaset tokenów na wywołanie) → limit 8000 znaków; opis jest krótki.
