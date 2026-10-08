## ADDED Requirements

### Requirement: Wczytywanie zdjęć z telefonu
Aplikacja Android SHALL wczytywać zdjęcia JPEG i HEIF z telefonu (udostępnione i z WhatsApp Images), obracać zdjęcia z aparatu zgodnie z ich orientacją i zmniejszać je do najwyżej 2048 px na dłuższym boku przed oceną, odczytem tekstu i wysyłką. Zdjęcie, którego nie da się otworzyć, MUST zostać na telefonie.

#### Scenario: Zdjęcie z aparatu
- **WHEN** użytkownik udostępnia zdjęcie 4000×3000 zrobione aparatem telefonu
- **THEN** telefon wczytuje je jako obraz 2048×1536 i wysyła jako dokument wybranej grupy

#### Scenario: Plik niedostępny
- **WHEN** zdjęcia nie da się otworzyć
- **THEN** nic nie jest wysyłane, a użytkownik widzi komunikat, że zdjęcie zostaje na telefonie
