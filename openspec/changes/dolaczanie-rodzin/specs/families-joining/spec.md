## Purpose

Dołączanie do aplikacji: prośby o dostęp akceptowane przez operatora i członkowie rodziny dodawani przez samą rodzinę.

## ADDED Requirements

### Requirement: Prośba o dostęp
Logowanie kontem Google z adresu spoza listy dozwolonych SHALL zapisywać prośbę o dostęp z adresem i imieniem z konta Google. Takie konto MUST NOT mieć profilu ani dostępu do danych, dopóki operator nie zaakceptuje prośby albo rodzina nie doda adresu. PWA SHALL pokazywać takiemu użytkownikowi, że prośba czeka na akceptację albo została odrzucona.

#### Scenario: Nowa osoba
- **WHEN** osoba spoza listy loguje się przez Google
- **THEN** powstaje prośba o dostęp, a PWA pokazuje „Czekasz na akceptację” i nie pokazuje żadnych danych

### Requirement: Powiadomienie i decyzja operatora
Operator (admin) SHALL dostać powiadomienie push o każdej nowej prośbie dokładnie raz. Panel admina SHALL pokazywać oczekujące prośby. Akceptacja SHALL tworzyć nową rodzinę z tym adresem; odrzucenie SHALL zamykać prośbę bez kolejnych powiadomień. Tylko admin MAY czytać i rozpatrywać prośby.

#### Scenario: Akceptacja
- **WHEN** operator akceptuje prośbę ola@example.com
- **THEN** powstaje nowa rodzina, adres trafia na listę dozwolonych, a konto Oli dostaje profil w tej rodzinie

#### Scenario: Jedno powiadomienie
- **WHEN** worker dwa razy sprawdza prośby, a w międzyczasie nie przyszła nowa
- **THEN** admin dostaje jedno powiadomienie

### Requirement: Członkowie rodziny
Członek rodziny SHALL widzieć adresy członków swojej rodziny oraz dodawać i usuwać je bez udziału operatora. Dodanie adresu należącego do innej rodziny MUST być odrzucone. Członek MUST NOT usunąć siebie ani administratora. Dodany adres z oczekującą prośbą SHALL od razu dostać profil w tej rodzinie, a prośba SHALL zniknąć.

#### Scenario: Drugi rodzic
- **WHEN** Ola dodaje w „Moja rodzina” adres męża, który wcześniej wysłał prośbę o dostęp
- **THEN** mąż ma profil w rodzinie Oli bez akceptacji operatora, a prośba znika z panelu admina
