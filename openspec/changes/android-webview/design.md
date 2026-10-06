# Design

## Decisions

### D1. WebView zamiast Trusted Web Activity
TWA uruchamia PWA w Chrome i nie pozwala pokazać natywnego ekranu w tej samej aktywności, a pełny ekran wymaga Digital Asset Links z podpisem APK (APK budowane w CI kluczem debug). WebView w tej samej aktywności daje jedną aplikację z oboma widokami.

### D2. Logowanie przez przeglądarkę i `czyzyk://auth/callback`
Google odrzuca OAuth w WebView (`disallowed_useragent`). PWA w aplikacji wywołuje `signInWithOAuth` z `redirectTo = czyzyk://auth/callback`; WebView nie otwiera adresów spoza PWA, tylko przekazuje je przeglądarce. Supabase po logowaniu przekierowuje na `czyzyk://auth/callback?code=…`, Android przechwytuje link i ładuje `<PWA>/?code=…` w WebView. Weryfikator PKCE leży w `localStorage` WebView (tam wywołano logowanie), więc wymiana kodu na sesję udaje się tylko w tym WebView – przechwycony kod jest bezużyteczny gdzie indziej.

### D3. Most JS `CzyzykAndroid`
`addJavascriptInterface` z dwiema metodami: `isApp()` i `openPhoneSettings()`. Nie zwraca danych i nie wykonuje akcji poza otwarciem natywnego ekranu, a WebView ładuje wyłącznie strony z adresu PWA (inne idą do przeglądarki), więc obca strona nie dostaje mostu.

### D4. Adres PWA
Link parowania dostaje `app=<origin PWA>` (opcjonalny, tylko https lub http dla localhost). Adres zapisany w `AppState`; ręczne pole na ekranie telefonu pozwala go ustawić lub zmienić bez ponownego parowania.

## Risks / Trade-offs

- Bez wpisu `czyzyk://auth/callback` w Supabase logowanie w aplikacji wraca na stronę PWA w przeglądarce → opis w dokumentacji wdrożenia; w przeglądarce PWA działa jak dotąd.
- WebView nie obsługuje Web Push → powiadomienia nadal przez PWA zainstalowaną z przeglądarki.
