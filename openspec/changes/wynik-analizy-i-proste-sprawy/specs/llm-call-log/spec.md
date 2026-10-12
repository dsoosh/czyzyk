## Purpose

Wynik zapisu i kopiowanie wywołania w dzienniku LLM.

## ADDED Requirements

### Requirement: Wynik zapisu i kopiowanie wywołania
Dziennik wywołań analizy SHALL zapisywać, co z odpowiedzi modelu zostało zapisane: liczby utworzonych, zmienionych, odwołanych i oddanych do przeglądu spraw oraz odrzucone operacje z powodem. Panel SHALL pokazywać ten wynik i SHALL mieć przycisk kopiujący całe wywołanie (zapytanie, odpowiedź, wynik, prompt systemowy, błąd) jako tekst.

#### Scenario: Odrzucona operacja
- **WHEN** model zwraca operację z nieznanym aliasem sprawy
- **THEN** panel pokazuje ją jako odrzuconą z powodem, a „Kopiuj całość” kopiuje ten powód razem z zapytaniem i odpowiedzią
