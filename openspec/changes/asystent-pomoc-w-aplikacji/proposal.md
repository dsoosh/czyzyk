# Proposal

## Why

Asystent „Zapytaj” odpowiada tylko na pytania o dane ekranu (wydarzenia, rzeczy, płatności). Użytkownik chce, żeby umiał też powiedzieć, co i jak zrobić w aplikacji, i podać link do miejsca, gdzie to się robi.

Zmiana na prośbę użytkownika. **Gotowe, gdy:** asystent odpowiada na pytania o obsługę aplikacji krokami i linkiem, a PWA pokazuje ten link jako klikalny i prowadzi do właściwego ekranu lub sekcji ustawień.

## What Changes

- **Przewodnik po aplikacji:** lista miejsc (`APP_PLACES` w `@czyzyk/shared/assistant`): ścieżka, nazwa i to, co można tam zrobić.
  - Trafia do promptu systemowego asystenta jako blok `<aplikacja>`.
  - Strony admina są w bloku tylko dla operatora.
- **Stała zasada asystenta:** pytania o obsługę aplikacji dostają 1–4 kroki i link markdown `[nazwa](ścieżka)`, wyłącznie z bloku `<aplikacja>`. Przy sprawie z danych ekranu asystent podaje też link do miejsca, gdzie rodzina ją załatwi.
- **PWA:**
  - linki markdown w odpowiedzi do znanych miejsc są linkami w aplikacji i zamykają panel;
  - inne linki (np. z treści wiadomości) zostają zwykłym tekstem;
  - sekcje ustawień mają kotwice (`#dzieci`, `#rodzina`, `#numer`, `#powiadomienia`, `#kalendarz`), do których strona się przewija.

## Capabilities

### New Capabilities

(brak)

### Modified Capabilities

- `view-assistant`: pomoc w obsłudze aplikacji z linkami.

## Impact

- Shared: `assistant.ts` (`APP_PLACES`, `appGuide`, `isAppPlace`), `prompts.ts` (stała zasada).
- API: `assistant/context.ts` (blok `<aplikacja>`).
- PWA:
  - `AnswerText`;
  - `AssistantPanel`;
  - `SettingsPage` i kotwice sekcji ustawień.
