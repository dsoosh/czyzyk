# Spec Delta

## Purpose

Pozyskuje z telefonu właściciela pełny eksport śledzonych czatów WhatsApp z multimediami – jednym kliknięciem lub ręcznie – i bezpiecznie przekazuje go na serwer, bez ingerencji w protokół WhatsApp.

## ADDED Requirements

### Requirement: Propozycja synchronizacji
Aplikacja Android SHALL wyświetlać lokalne powiadomienie „Zsynchronizuj czaty”, gdy licznik zaległych załączników jest większy od zera albo od ostatniego eksportu minęło N godzin (ustawienie, domyślnie 24) i od tego czasu przyszły nowe wiadomości. Eksport MUST być dostępny także z przycisku w aplikacji i z kafelka Szybkich ustawień.

#### Scenario: Zaległe zdjęcie
- **WHEN** w śledzonej grupie przyszło powiadomienie „📷 Zdjęcie”
- **THEN** aplikacja pokazuje lokalne powiadomienie „Zsynchronizuj czaty (1 załącznik)”

### Requirement: Eksport na klik
Po kliknięciu przez użytkownika aplikacja SHALL dla każdej śledzonej grupy przejść w WhatsAppie ścieżkę: czat → menu → Więcej → Eksportuj czat → Dołącz multimedia → udostępnij do aplikacji Czyżyk. Automatyzacja MUST startować wyłącznie z kliknięcia użytkownika, MUST działać tylko przy odblokowanym ekranie i MUST mieć limit czasu na każdy krok.

#### Scenario: Udany eksport dwóch grup
- **WHEN** użytkownik stuka „Zsynchronizuj czaty” przy odblokowanym telefonie, a śledzone są dwie grupy
- **THEN** aplikacja kolejno eksportuje obie grupy i pokazuje „Wysłano 2 eksporty”

#### Scenario: Zablokowany ekran
- **WHEN** eksport miałby się rozpocząć przy zablokowanym ekranie
- **THEN** automatyzacja nie startuje, a powiadomienie prosi o odblokowanie telefonu

### Requirement: Raportowanie awarii automatyzacji
Gdy krok automatyzacji nie znajdzie oczekiwanego elementu w limicie czasu, aplikacja SHALL przerwać eksport tej grupy, wrócić do ekranu aplikacji i wysłać na serwer błąd z nazwą kroku i wersją WhatsAppa (bez treści czatu).

#### Scenario: Zmienione menu WhatsAppa
- **WHEN** po aktualizacji WhatsAppa nie da się znaleźć pozycji „Eksportuj czat”
- **THEN** admin widzi w dzienniku synchronizacji błąd „krok: eksportuj_czat, WhatsApp 2.26.x”, a aplikacja proponuje eksport ręczny

### Requirement: Eksport ręczny przez udostępnianie
Aplikacja SHALL być celem udostępniania plików ZIP, tak aby eksport wykonany ręcznie w WhatsAppie („Eksportuj czat” → Czyżyk) był przetwarzany tak samo jak automatyczny. Eksport grupy nieśledzonej MUST zostać odrzucony na telefonie bez wysyłki.

#### Scenario: Ręczny eksport
- **WHEN** właściciel sam eksportuje czat „Motylki” i wybiera Czyżyk w oknie udostępniania
- **THEN** paczka trafia na serwer i jest przetwarzana

### Requirement: Bezpieczna wysyłka paczki
Aplikacja SHALL wysyłać ZIP bezpośrednio do prywatnego magazynu przez jednorazowy, krótko ważny podpisany URL uzyskany z serwera tokenem urządzenia, a następnie zarejestrować paczkę na serwerze. Przerwana wysyłka MUST być wznawiana z kolejki offline.

#### Scenario: Utrata sieci w trakcie wysyłki
- **WHEN** połączenie zrywa się w trakcie wysyłania ZIP-a
- **THEN** wysyłka jest ponawiana po odzyskaniu sieci, a paczka jest rejestrowana dokładnie raz
