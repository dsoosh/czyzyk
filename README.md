# Czyżyk – asystent przedszkolny

Prywatna aplikacja rodzinna (PWA), która wyciąga z grup WhatsApp przedszkola wydarzenia, rzeczy do przyniesienia, płatności (także ze zdjęć planów i ogłoszeń) oraz odpowiada na pytania o historię rozmów.

- Specyfikacja źródłowa: [`docs/specyfikacja.md`](docs/specyfikacja.md)
- Wymagania wykonawcze: [`openspec/`](openspec/) (spec-driven development, [OpenSpec](https://github.com/Fission-AI/OpenSpec))

## Praca z OpenSpec

Każda zmiana zachowania systemu przechodzi przez OpenSpec:

1. **Propozycja** – `/opsx:propose "opis"` (Claude Code) tworzy `openspec/changes/<nazwa>/` z `proposal.md`, deltami specyfikacji, `design.md` i `tasks.md`.
2. **Implementacja** – `/opsx:apply <nazwa>` realizuje zadania z `tasks.md` i odhacza je.
3. **Archiwizacja** – `/opsx:archive <nazwa>` przenosi zmianę do `openspec/changes/archive/` i scala delty do `openspec/specs/`.

Przydatne komendy:

```bash
npm install
npx openspec list             # zmiany w toku
npx openspec list --specs     # obowiązujące capability
npx openspec show <nazwa>     # podgląd zmiany lub specyfikacji
npm run spec:validate         # walidacja wszystkiego w trybie strict
```

Konwencje projektu (język, stos, niezmienniki bezpieczeństwa, reguły artefaktów) są w [`openspec/config.yaml`](openspec/config.yaml).

## Plan – sześć etapów

| Zmiana | Zakres | Gotowe, gdy |
| --- | --- | --- |
| `etap-1-fundament` | monorepo, schemat z RLS, hook logowania, Railway, logowanie Google | loguje się tylko e-mail z listy |
| `etap-2-pierwszy-przeplyw-danych` | czytnik powiadomień, ingest, ekstrakcja LLM, „Dziś i jutro”, kalendarz | „w piątek bal, przebrania” w PWA w ≤ 35 min |
| `etap-3-codzienne-uzycie` | checklisty, płatności, sprawy, iCal, Web Push, kolejka `needs_review` | codzienne użycie przez rodzinę |
| `etap-4-eksport-i-zdjecia` | eksport na klik, filtr obrazów na telefonie, parser `_chat.txt`, ekstrakcja z dokumentów | plan miesiąca → wydarzenia; zdjęcia ludzi nie opuszczają telefonu |
| `etap-5-chatbot` | embeddingi, wyszukiwanie hybrydowe, „Zapytaj”, ściągawka | odpowiedzi z cytatami |
| `etap-6-szlify` | zdrowie synchronizacji, usunięte wiadomości | baner po 24 h, usunięte → przegląd |

Etapy realizujemy po kolei: etap N+1 zaczyna się po archiwizacji etapu N.
