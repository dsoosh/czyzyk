# Spec Delta

## Purpose

Pozwala rodzinie zdecydować, które grupy WhatsApp właściciela telefonu trafiają do aplikacji i pod jakimi nazwami, tak by prywatne rozmowy nigdy nie opuszczały telefonu.

## ADDED Requirements

### Requirement: Tylko śledzone grupy opuszczają telefon
Aplikacja Android SHALL wysyłać treść wiadomości wyłącznie z grup oznaczonych jako śledzone na serwerze. Wiadomości prywatne (nie grupowe) MUST NOT być nigdy wysyłane.

#### Scenario: Wiadomość z nieśledzonej grupy
- **WHEN** przychodzi powiadomienie z grupy „Sąsiedzi”, która nie jest śledzona
- **THEN** jej treść nie jest wysyłana na serwer

#### Scenario: Wiadomość prywatna
- **WHEN** przychodzi powiadomienie z rozmowy jeden na jeden
- **THEN** nic nie jest wysyłane na serwer

### Requirement: Wykrywanie grup bez treści
Aplikacja Android SHALL zgłaszać serwerowi same nazwy grup, z których przyszły powiadomienia, bez treści, autorów ani czasu wiadomości, aby admin mógł je oznaczyć jako śledzone.

#### Scenario: Nowa grupa przedszkolna
- **WHEN** na telefon przychodzi pierwsze powiadomienie z grupy „Motylki 2026/27”
- **THEN** w panelu admina grupa pojawia się na liście jako nieśledzona, bez żadnych wiadomości

### Requirement: Admin zarządza śledzeniem i nazwami
System SHALL pozwalać adminowi włączyć lub wyłączyć śledzenie grupy i nadać jej nazwę wyświetlaną. Aplikacja Android MUST pobrać aktualną listę śledzonych grup najpóźniej 15 minut po zmianie.

#### Scenario: Admin włącza śledzenie
- **WHEN** admin oznacza grupę „Motylki 2026/27” jako śledzoną z nazwą „Motylki”
- **THEN** w ciągu 15 minut kolejne wiadomości z tej grupy trafiają na serwer, a PWA pokazuje je pod nazwą „Motylki”

#### Scenario: Admin wyłącza śledzenie
- **WHEN** admin wyłącza śledzenie grupy
- **THEN** w ciągu 15 minut telefon przestaje wysyłać jej wiadomości, a dotychczasowe dane pozostają w bazie
