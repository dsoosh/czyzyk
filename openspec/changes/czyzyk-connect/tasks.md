# Tasks

## 1. Nazwa i pakiet

- [ ] 1.1 `applicationId` `pl.czyzyk.connect`, `app_name` i teksty „Czyżyk Connect”, `APK_NAME` w aplikacji i workflow; weryfikacja: testy jednostkowe Androida w CI (nazwa, adres APK), build release w CI
- [x] 1.2 PWA (Admin → Urządzenia) i dokumentacja; weryfikacja: testy PWA, przegląd
- [ ] 1.3 Wydanie `czyzyk-connect.apk` po merge; weryfikacja: przebieg Android release i pobranie pliku z `releases/latest/download/czyzyk-connect.apk`

## 2. Współistnienie z PWA

- [x] 2.1 Ikona Czyżyk Connect ze znaczkiem telefonu we wszystkich gęstościach; weryfikacja: podgląd wygenerowanych plików
- [x] 2.2 Linki do hosta aplikacji nie trafiają do systemu (`WebRules.isAppHost`); weryfikacja: test jednostkowy `WebRulesTest`
- [x] 2.3 Dopisek „Connect” przy nazwie w aplikacji Android; weryfikacja: test PWA
