## ADDED Requirements

### Requirement: Obraz dokumentu w jednej linii base64
Obraz dokumentu przekazywany modelowi (kontrola obrazu, analiza) i rodzinie (podgląd w historii wydarzenia) MUST być zakodowany w base64 bez znaków nowej linii, niezależnie od rozmiaru obrazu.

#### Scenario: Zdjęcie kalendarza dni wolnych
- **WHEN** na serwer trafia zdjęcie dokumentu większe niż kilkadziesiąt bajtów
- **THEN** kontrola obrazu przez model kończy się oceną, a nie błędem 400
