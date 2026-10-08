## ADDED Requirements

### Requirement: Zdjęcie świadomie udostępnione to dokument
Zdjęcie, które użytkownik udostępnia do aplikacji Android, SHALL być traktowane jako dokument bez oceny „dokument / ludzie” na telefonie. Telefon MUST zmniejszyć je i zapisać od nowa bez metadanych EXIF oraz SHALL dołączyć tekst odczytany na telefonie. Serwer MUST przed zapisaniem sprawdzić obraz i usunąć go, gdy widać na nim ludzi, zostawiając tylko odczytany tekst. Zdjęcia znalezione automatycznie w folderze WhatsApp Images MUST być nadal oceniane na telefonie.

#### Scenario: Plakat sfotografowany pod kątem
- **WHEN** użytkownik udostępnia do aplikacji zdjęcie plakatu, które ocena na telefonie uznałaby za zwykłe zdjęcie
- **THEN** obraz trafia na serwer jako dokument wybranej grupy

#### Scenario: Na udostępnionym zdjęciu są dzieci
- **WHEN** użytkownik udostępnia zdjęcie, na którym widać dzieci
- **THEN** serwer usuwa obraz po kontroli i zostaje tylko odczytany tekst
