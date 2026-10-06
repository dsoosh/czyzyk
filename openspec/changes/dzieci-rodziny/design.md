# Design

## Decisions

### D1. Dzieci jako osobna tabela, przypisanie jako `child_ids uuid[]`
`children (id, name, group_id)` z unikalnym imieniem (bez rozróżniania wielkości liter), żeby imię z wiadomości jednoznacznie wskazywało dziecko. Elementy dostają `child_ids uuid[] not null default '{}'` (wydarzenia, rzeczy, płatności, sprawy). Pusta tablica = dotyczy grupy jako całości. Usunięcie dziecka zostawia nieaktualne identyfikatory, które PWA pomija.

### D2. Zapis przez RPC dla członków rodziny
Jak przy oznaczaniu spakowane/zapłacone: `save_child(p_id, p_name, p_group_id)` i `delete_child(p_id)` są `security definer` i sprawdzają `is_family()`; bezpośredni zapis do tabeli jest zablokowany. Każdy rodzic może zarządzać dziećmi.

### D3. `children` na poziomie operacji, nie w danych elementu
Pole operacji (jak `source_messages`), a nie część danych typu, więc kontrakt danych, przegląd admina (`pending_patch`) i walidacja aktualizacji zostają bez zmian. Przy `create` zapisuje `child_ids`; przy `update` niepusta lista zastępuje przypisanie, pusta je zostawia. Imiona dopasowywane bez wielkości liter i białych znaków; nieznane – pomijane (model może się pomylić, element i tak powstaje).

### D4. Wyświetlanie: wprost albo z grupy
PWA pokazuje imiona z `child_ids`; gdy pusta, imiona dzieci, których grupa jest grupą elementu (dla elementów całego przedszkola – nic). Jedno dziecko w grupie oznacza więc, że wszystkie elementy tej grupy pokazują jego imię.

## Risks / Trade-offs

- Imiona dzieci trafiają do modelu (jak treść wiadomości) → tylko na serwerze, dla ekstrakcji i asystenta.
- Zdrobnienia („Zosia” vs „Zofia”) → w Ustawieniach podpowiedź, by wpisać imię tak, jak piszą nauczycielki; model dostaje listę i ma używać imion z niej.
