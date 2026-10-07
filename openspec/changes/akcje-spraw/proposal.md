# Proposal

## Why

Sprawy „wymaga odpowiedzi” mają dziś tylko odhaczenie „załatwione”. Część z nich to w praktyce rzeczy do przyniesienia („Zakup i doniesienie sprayu przeciwko insektom”), płatności albo pytania z odpowiedzią tak/nie („Czy Elena chce wziąć udział w zajęciach szachowych?”). Rodzina chce jednym stuknięciem przenieść sprawę tam, gdzie pasuje, albo zapisać odpowiedź.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** przy otwartej sprawie widać 1–4 akcje zaproponowane przez model i dopasowane do treści, a wybranie akcji wykonuje ją i zamyka sprawę z adnotacją.

## What Changes

- Analiza wiadomości: dla `action_required` model proponuje akcje (`suggestions`) z ustalonego zestawu: do przyniesienia, do zapłaty, do kalendarza, odpowiedź (z etykietą, np. „Tak, zapisujemy”), zrobione, nie dotyczy – reguła 15 w domyślnym prompcie.
- Baza: kolumny `suggested_actions` i `resolution`, RPC `apply_action_suggestion` (tworzy rzecz/płatność/wydarzenie z tą samą grupą, dziećmi i źródłem, zamyka sprawę z etykietą akcji); cofnięcie „załatwione” czyści adnotację.
- PWA: przyciski akcji przy otwartych sprawach na liście „Wymaga odpowiedzi” i na ekranie „Dziś”; po wyborze potwierdzenie i adnotacja („Tak, zapisujemy”).

**Poza zakresem:** wysyłanie odpowiedzi do grupy WhatsApp, propozycje dla starszych spraw bez ponownej analizy.

## Capabilities

### New Capabilities

- `action-suggestions`: proponowane akcje spraw „wymaga odpowiedzi”.

### Modified Capabilities

(brak – domyślny prompt analizy rozszerzony w niezarchiwizowanej zmianie `prompty-llm`)

## Impact

- Migracja `0016_action_suggestions.sql`; `packages/shared` (schemat `suggestions`, reguła 15); `services/worker` (zapis propozycji); `apps/pwa` (komponent akcji, lista spraw, ekran „Dziś”).
