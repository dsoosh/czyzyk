## ADDED Requirements

### Requirement: Udostępnienie eksportu do aplikacji Android
Aplikacja Android SHALL przyjmować eksport czatu udostępniony z WhatsAppa (plik `.txt` albo `.zip`, także jako kilka plików) i otwierać import w PWA z wczytanym tekstem czatu. Z paczki ZIP MUST być odczytywany wyłącznie plik czatu; multimedia MUST NOT opuszczać telefonu.

#### Scenario: Eksport z multimediami
- **WHEN** właściciel telefonu eksportuje czat „SOKOŁY - Cztery Żywioły” z multimediami i wybiera Czyżyka w menu Udostępnij
- **THEN** aplikacja otwiera Admin → Import z podglądem wiadomości i podpowiedzianą grupą, a do serwera trafia tylko tekst czatu po zatwierdzeniu

#### Scenario: Udostępnienie czegoś innego
- **WHEN** do aplikacji trafiają same zdjęcia
- **THEN** aplikacja informuje, że to nie jest eksport czatu, i niczego nie wysyła
