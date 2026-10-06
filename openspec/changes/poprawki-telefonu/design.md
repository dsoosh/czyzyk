# Design

## Decisions

### D1. Jedna normalizacja w trzech miejscach
`NFC` → usunięcie znaków formatujących (U+00AD, U+061C, U+180E, U+200B–U+200F, U+202A–U+202E, U+2060–U+2069, U+FEFF) → zwinięcie białych znaków → przycięcie. Ta sama reguła: Kotlin (telefon, zanim porówna z listą śledzonych i wyśle), TypeScript (schemat zod ingestu), SQL (`normalize_group_name`, migracja). Wielkość liter zostaje – to część nazwy.

### D2. Scalanie duplikatów w migracji
Dla każdej znormalizowanej nazwy z więcej niż jedną grupą: zostaje grupa śledzona, potem z większą liczbą wiadomości, potem starsza. Referencje (`messages`, sześć tabel elementów, `children`) przechodzą do niej; `tracked` = którakolwiek śledzona, `display_name` = pierwsza niepusta, `last_*_at` = najnowsze. Na końcu wszystkie `wa_name` dostają postać znormalizowaną. Klucze dopasowania wiadomości zawierają identyfikator grupy, więc przeniesienie nie łamie unikalności `(group_id, dedupe_key)`.

### D3. Udostępnianie: tekst wyciągany na telefonie, import w PWA
Intent `SEND`/`SEND_MULTIPLE` (`text/plain`, ZIP, `*/*` dla wielu plików). Telefon czyta strumieniowo: z ZIP-a buforuje tylko wpisy `.txt` i wybiera czat tą samą regułą co PWA (`_chat.txt`, „WhatsApp Chat…/Czat WhatsApp…”, dowolny `.txt` w katalogu głównym); limit 15 MB. Potem ładuje `<PWA>/admin/import`, a strona odbiera czat przez `CzyzykAndroid.takeSharedChat()` (JSON z nazwą pliku i tekstem, odczyt jednorazowy). Import idzie dalej istniejącą ścieżką z sesją admina – bez nowego endpointu i bez zmian uprawnień.

## Risks / Trade-offs

- `*/*` przy `SEND_MULTIPLE` sprawia, że aplikacja pojawia się też przy udostępnianiu kilku zdjęć → wtedy komunikat „to nie jest eksport czatu”, nic nie jest wysyłane.
