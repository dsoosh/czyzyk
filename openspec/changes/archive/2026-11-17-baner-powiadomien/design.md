# Design

## Decisions

### D1. Zgoda tylko po stuknięciu
Baner nigdy sam nie wywołuje `Notification.requestPermission()`. Safari na iOS wymaga gestu użytkownika, a Chrome prośby bez gestu wycisza i może trwale ukryć. Okienko zgody pojawia się dopiero po „Włącz”.

### D2. Kiedy baner jest widoczny
Wszystkie warunki naraz: przeglądarka obsługuje push albo to iPhone bez instalacji; jest `VITE_API_URL` i `VITE_VAPID_PUBLIC_KEY`; `Notification.permission` nie jest `denied`; na urządzeniu nie ma subskrypcji; „Nie teraz” nie było stuknięte w ciągu 30 dni; bieżąca strona to nie `/ustawienia` (tam jest pełna sekcja). Zgoda `granted` bez subskrypcji też pokazuje baner – „Włącz” zasubskrybuje wtedy bez okienka.

### D3. „Nie teraz” w `localStorage`
Klucz `czyzyk.pushBanner.dismissedAt` z datą ISO. Odmowa dotyczy urządzenia, nie konta, więc nie trafia do bazy. Gdy `localStorage` jest niedostępny, baner pokazuje się normalnie, a „Nie teraz” chowa go do przeładowania.

### D4. Czyżyk Connect
WebView na Androidzie nie ma `PushManager`, więc `pushSupport()` zwraca `unsupported` i banera nie ma. Powiadomienia w aplikacji na Androida to osobna zmiana.
