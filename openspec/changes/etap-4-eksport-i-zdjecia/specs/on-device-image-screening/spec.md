# Spec Delta

## Purpose

Rozstrzyga na telefonie, przed jakąkolwiek wysyłką, czy załącznik z grupy przedszkolnej jest dokumentem z informacjami organizacyjnymi, tak aby zdjęcia ludzi – w szczególności dzieci – nigdy nie opuściły telefonu.

## ADDED Requirements

### Requirement: Analiza wyłącznie na telefonie
Każdy obraz z eksportu SHALL być analizowany wyłącznie na telefonie modelami działającymi lokalnie. Obraz MUST NOT być przesyłany do żadnej usługi zewnętrznej (w tym usług chmurowych dostawcy modeli) w celu tej analizy.

#### Scenario: Analiza bez sieci
- **WHEN** telefon jest w trybie samolotowym, a użytkownik udostępnia eksport do aplikacji
- **THEN** kontrola obrazów kończy się normalnie, a paczka czeka w kolejce na sieć

### Requirement: Trzy możliwe decyzje
Dla każdego obrazu aplikacja SHALL podjąć jedną decyzję: `image` – obraz zawiera czytelny tekst organizacyjny i nie wykryto na nim ludzi (wysyłany jest obraz); `text_only` – obraz zawiera czytelny tekst, ale wykryto na nim ludzi (wysyłany jest tylko tekst rozpoznany na telefonie); `withheld` – pozostałe przypadki (nic nie jest wysyłane). Wykrycie twarzy lub osoby w dowolnej części obrazu MUST wykluczać decyzję `image`.

#### Scenario: Zdjęcie planu miesiąca
- **WHEN** obraz to sfotografowana tabela „Plan na październik” bez ludzi
- **THEN** decyzja to `image`

#### Scenario: Plakat ze zdjęciem dzieci
- **WHEN** obraz to plakat „Bal jesienny 24.10” ze zdjęciem dzieci w przebraniach
- **THEN** decyzja to `text_only` i wysyłany jest tylko tekst „Bal jesienny 24.10 …”

#### Scenario: Zdjęcie z zajęć
- **WHEN** obraz przedstawia dzieci przy stoliku z kasztanami
- **THEN** decyzja to `withheld` i nic z tego obrazu nie opuszcza telefonu

#### Scenario: Osoba widziana z tyłu
- **WHEN** na obrazie z tekstem nie wykryto twarzy, ale wykryto sylwetkę osoby
- **THEN** decyzja nie jest `image`

### Requirement: Domyślnie nie wysyłaj
W razie wątpliwości (błąd analizy, niska pewność detektorów, nieobsługiwany format, przekroczony limit czasu) aplikacja SHALL podjąć decyzję `withheld`. Filmy, notatki głosowe i naklejki MUST zawsze dostawać `withheld` bez analizy.

#### Scenario: Błąd modelu
- **WHEN** analiza obrazu kończy się błędem
- **THEN** decyzja to `withheld`

#### Scenario: Film
- **WHEN** eksport zawiera plik wideo
- **THEN** plik nie jest analizowany ani wysyłany

### Requirement: Dokumenty PDF
Plik PDF SHALL być analizowany strona po stronie tymi samymi regułami; PDF może zostać wysłany jako plik tylko wtedy, gdy wszystkie strony dostały decyzję `image`, w przeciwnym razie wysyłany jest wyłącznie tekst stron z decyzją `image` lub `text_only`.

#### Scenario: PDF ze zdjęciem na ostatniej stronie
- **WHEN** trzystronicowy PDF z jadłospisem ma na trzeciej stronie zdjęcie dzieci
- **THEN** na serwer trafia tylko tekst trzech stron, a nie plik PDF

### Requirement: Manifest decyzji bez treści wstrzymanych
Paczka przefiltrowana SHALL zawierać manifest z decyzją dla każdego załącznika wymienionego w `_chat.txt` (nazwa pliku, decyzja, tekst rozpoznany przy `text_only`). Dla decyzji `withheld` manifest MUST NOT zawierać żadnej treści obrazu, opisu ani tekstu.

#### Scenario: Wstrzymane zdjęcie w manifeście
- **WHEN** zdjęcie `IMG-20261009-WA0003.jpg` dostało decyzję `withheld`
- **THEN** manifest zawiera tylko nazwę pliku i decyzję `withheld`

### Requirement: Przejrzystość dla właściciela
Aplikacja Android SHALL pokazywać po każdym eksporcie podsumowanie decyzji (ile obrazów wysłano, ile jako tekst, ile wstrzymano) i pozwalać podejrzeć na telefonie obrazy wysłane w ostatnim eksporcie (kopie z paczki przefiltrowanej, usuwane przy kolejnym eksporcie).

#### Scenario: Podsumowanie
- **WHEN** eksport zakończył się powodzeniem
- **THEN** właściciel widzi „Motylki: wysłano 1 dokument, 1 jako tekst, wstrzymano 40 zdjęć”
