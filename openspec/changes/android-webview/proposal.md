# Proposal

## Why

Telefon właściciela ma aplikację Android tylko jako źródło danych (czytnik powiadomień i parowanie), a z samej aplikacji Czyżyk (PWA) korzysta się w przeglądarce. Właściciel chce w jednej aplikacji na telefonie mieć zarówno interfejs Czyżyka, jak i obecny ekran telefonu.

Zmiana poza kolejnością etapów, na prośbę użytkownika. **Gotowe, gdy:** po otwarciu aplikacji Android widać PWA (z zalogowaniem przez Google), a ekran parowania i uprawnień jest dostępny jako „Ustawienia telefonu”.

## What Changes

- Android: główny widok to WebView z PWA. Obecny ekran (parowanie, uprawnienia, kolejka, synchronizacja) staje się ekranem „Ustawienia telefonu”, pokazywanym też wtedy, gdy adres PWA nie jest znany albo strona się nie ładuje.
- Adres PWA: nowy parametr `app` w linku parowania (PWA dopisuje swój adres) oraz ręczne pole na ekranie telefonu.
- Logowanie Google: Google blokuje logowanie w osadzonym WebView, więc strony spoza adresu PWA (w tym logowanie) otwierają się w przeglądarce telefonu, a powrót następuje przez `czyzyk://auth/callback?code=…`, który aplikacja ładuje w WebView, kończąc logowanie (PKCE).
- PWA: wykrywa uruchomienie w aplikacji Android (most `CzyzykAndroid`), wtedy loguje z przekierowaniem `czyzyk://auth/callback` i pokazuje w Ustawieniach przycisk „Ustawienia telefonu”.
- WebView: wybór plików (import eksportu czatu), przycisk Wstecz cofa w historii strony.

**Poza zakresem:** powiadomienia Web Push wewnątrz WebView (Android WebView ich nie obsługuje – zostają powiadomienia w przeglądarce/zainstalowanej PWA), tryb offline WebView, publikacja w Sklepie Play.

## Capabilities

### New Capabilities

- `android-app-shell`: aplikacja Android jako powłoka PWA z ekranem ustawień telefonu.

### Modified Capabilities

(brak)

## Impact

- `apps/android`: `MainActivity` (nawigacja WebView ↔ ustawienia telefonu), nowy `web/` (WebView, przechwytywanie logowania, most JS), `AppState` (adres PWA), `PairingLink` (parametr `app`), manifest (`czyzyk://auth`).
- `apps/pwa`: `AuthProvider` (przekierowanie w aplikacji), `DevicesPage` (parametr `app`), Ustawienia (przycisk).
- Konfiguracja Supabase: dodać `czyzyk://auth/callback` do Authentication → URL Configuration → Redirect URLs (opis w `docs/wdrozenie.md`).
