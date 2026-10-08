# Proposal

## Why

Każde zdjęcie, zarówno udostępnione ręcznie, jak i znalezione w WhatsApp Images, kończyło się na telefonie komunikatem „nie udało się odczytać” albo „to nie wygląda na dokument”. Przyczyną był błąd we wczytywaniu obrazu. Pierwszy krok (odczyt samych wymiarów, `inJustDecodeBounds`) zawsze zwraca `null`, a kod traktował to jako brak pliku i przerywał. W efekcie żaden obraz nie trafiał do oceny ani na serwer.

Poprawka błędu, na zgłoszenie użytkownika. **Gotowe, gdy:** zdjęcia JPEG i HEIF z telefonu są wczytywane, zmniejszane i trafiają dalej, a zdjęcia z aparatu są obrócone tak, jak zostały zrobione.

## What Changes

- Nowy `PhotoDecoder`:
  - od Androida 9 używa `ImageDecoder`, który obsługuje HEIF i obraca zdjęcie według orientacji EXIF;
  - na starszych wersjach używa poprawionego `BitmapFactory` (wymiary odczytywane z opcji, nie z wyniku);
  - wynik jest zmniejszony do 2048 px; brak pliku daje `null`.
- `DocumentScreener` korzysta z `PhotoDecoder` przy ocenie zdjęć z WhatsApp Images i przy zdjęciach udostępnionych.

**Poza zakresem:** zmiany zasad oceny zdjęć.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `document-import`: wczytywanie zdjęć z telefonu (JPEG, HEIF, orientacja).

## Impact

- Android: `PhotoDecoder` (nowy), `DocumentScreener`, test `PhotoDecoderTest`, `MIN_TESTS`.
