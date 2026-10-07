## MODIFIED Requirements

### Requirement: Dostarczenie mimo braku sieci
Aplikacja Android SHALL zapisywać każdą przechwyconą wiadomość w lokalnej kolejce przed wysłaniem i ponawiać wysyłkę z rosnącym odstępem aż do potwierdzenia przez serwer. Każda wiadomość MUST mieć klucz idempotencji nadany na telefonie, niezmienny między ponowieniami. Pierwsza próba wysyłki SHALL nastąpić od razu po przechwyceniu, także przy wygaszonym ekranie i w trybie Doze, bez czekania na okno serwisowe systemu. Ta sama wiadomość MUST NOT być wysyłana równolegle przez dwie ścieżki.

#### Scenario: Telefon offline
- **WHEN** wiadomość przychodzi, gdy telefon nie ma internetu
- **THEN** zostaje w kolejce i trafia na serwer po odzyskaniu połączenia, także po restarcie telefonu

#### Scenario: Ponowienie po zerwanym połączeniu
- **WHEN** serwer zapisał wiadomość, ale odpowiedź do telefonu nie dotarła i telefon wysyła ją ponownie
- **THEN** na serwerze istnieje dokładnie jedna kopia tej wiadomości

#### Scenario: Wygaszony ekran
- **WHEN** wiadomość z śledzonej grupy przychodzi przy wygaszonym ekranie, a telefon ma internet
- **THEN** trafia na serwer od razu, bez czekania na odblokowanie telefonu
