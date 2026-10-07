# Spec Delta

## Purpose

Na telefonie, przed wysyłką, wybiera ze zdjęć obserwowanych grup WhatsApp tylko dokumenty organizacyjne i łączy je z wiadomościami, tak aby zdjęcia dzieci nigdy nie opuściły telefonu.

## ADDED Requirements

### Requirement: Zdjęcia z obserwowanych grup sprawdzane na telefonie
Gdy użytkownik włączy w Czyżyk Connect opcję „Zdjęcia z grup” i da dostęp do zdjęć, aplikacja SHALL sprawdzać nowe zdjęcia z folderu „WhatsApp Images” lokalnie, modelami dołączonymi do aplikacji. Zdjęcie MUST NOT być wysyłane do żadnej usługi w celu tej kontroli. Zdjęcia z folderu wysłanych („Sent”) MUST być pomijane.

#### Scenario: Jadłospis w grupie
- **WHEN** w obserwowanej grupie ktoś wysyła zdjęcie jadłospisu, a WhatsApp je pobiera
- **THEN** po chwili telefon wysyła dokument do wiadomości „📷 Zdjęcie” tej grupy

#### Scenario: Opcja wyłączona
- **WHEN** opcja „Zdjęcia z grup” jest wyłączona albo nie ma dostępu do zdjęć
- **THEN** aplikacja nie czyta zdjęć ani nie zapisuje czasów powiadomień o zdjęciach

### Requirement: Jednoznaczne dopasowanie po czasie
Plik SHALL być łączony z wiadomością obserwowanej grupy tylko wtedy, gdy wszystkie powiadomienia o zdjęciach (z dowolnego czatu) w oknie od 10 minut przed do 2 minut po dodaniu pliku pochodzą z tej samej obserwowanej grupy. O innych czatach aplikacja MUST zapisywać wyłącznie czas zdjęcia, bez treści i nazw. Zdjęcie bez jednoznacznego dopasowania MUST zostać na telefonie.

#### Scenario: Zdjęcie z prywatnego czatu w tym samym czasie
- **WHEN** w ciągu tych samych minut przychodzi zdjęcie w obserwowanej grupie i w prywatnym czacie
- **THEN** żaden z plików nie jest wysyłany

#### Scenario: Album
- **WHEN** w obserwowanej grupie przychodzą trzy zdjęcia jedno po drugim
- **THEN** każdy plik jest łączony z wiadomością tej grupy

### Requirement: Trzy decyzje, domyślnie zostaw na telefonie
Każde dopasowane zdjęcie SHALL dostać decyzję: `image` (czytelny tekst, brak ludzi – wysyłany obraz i tekst), `text_only` (czytelny tekst i wykryta twarz lub osoba – wysyłany tylko tekst rozpoznany na telefonie) albo `withheld` (nic nie jest wysyłane). Błąd analizy, obraz mniejszy niż 400 px i brak czytelnego tekstu MUST dawać `withheld`. Wykrycie twarzy lub osoby MUST wykluczać `image`.

#### Scenario: Plakat ze zdjęciem dzieci
- **WHEN** zdjęcie to plakat „Bal jesienny 24.10” ze zdjęciem dzieci
- **THEN** wysyłany jest tylko tekst plakatu

#### Scenario: Zdjęcie z zajęć
- **WHEN** zdjęcie przedstawia dzieci bez czytelnego tekstu
- **THEN** nic z tego zdjęcia nie opuszcza telefonu

### Requirement: Obraz dokumentu bez metadanych
Obraz z decyzją `image` SHALL być wysyłany jako nowo zakodowany JPEG o dłuższym boku najwyżej 2048 px i rozmiarze najwyżej 1,5 MB, bez metadanych oryginału (w tym lokalizacji).

#### Scenario: Zdjęcie z lokalizacją GPS
- **WHEN** dokument ma w EXIF współrzędne GPS
- **THEN** wysłany obraz nie zawiera EXIF

### Requirement: Zdjęcie udostępnione ręcznie
Grupy z zaawansowaną ochroną prywatności czatu nie zapisują zdjęć, dlatego użytkownik SHALL móc udostępnić zdjęcie z WhatsAppa do Czyżyk Connect. Zdjęcie MUST przejść tę samą kontrolę na telefonie i SHALL zostać dołączone do najnowszej wiadomości ze zdjęciem z obserwowanej grupy z ostatnich 12 godzin; gdy takie wiadomości ma kilka grup, aplikacja MUST zapytać o grupę. Bez takiej wiadomości zdjęcie MUST zostać na telefonie.

#### Scenario: Jedna grupa
- **WHEN** użytkownik udostępnia zdjęcie jadłospisu, a zdjęcie w ostatnich godzinach przysłała tylko grupa „Motylki”
- **THEN** dokument trafia do najnowszej wiadomości ze zdjęciem z „Motylków”

#### Scenario: Kilka grup
- **WHEN** zdjęcia przysłały ostatnio dwie obserwowane grupy
- **THEN** aplikacja pyta, z której grupy jest zdjęcie

### Requirement: Podgląd z powiadomienia
Gdy powiadomienie o zdjęciu z obserwowanej grupy zawiera podgląd, a aplikacja może go odczytać, SHALL zachować go w prywatnym katalogu i – jeśli w ciągu minuty nie pojawi się zapisane zdjęcie tej wiadomości – sprawdzić go jak zdjęcie z folderu. Podglądy z innych czatów MUST NOT być odczytywane. Aplikacja SHALL pokazywać liczniki: zdjęcia z obserwowanych grup, podglądy dołączone, odczytane i największy rozmiar.

#### Scenario: Grupa z ochroną prywatności
- **WHEN** powiadomienie o zdjęciu z chronionej grupy ma czytelny podgląd jadłospisu
- **THEN** dokument z podglądu trafia do wiadomości tej grupy
