# Design

## Decisions

### D1. Nowy `applicationId`, ten sam kod
Zmienia się tylko `applicationId` (tożsamość instalacji), `namespace` i pakiety Kotlina zostają `pl.czyzyk.app` – bez przenoszenia plików. Android traktuje `pl.czyzyk.connect` jako osobną aplikację, więc nie ma konfliktu podpisu ani nazwy pakietu ze starą instalacją.

### D2. Nazwa pliku w jednym miejscu
`ReleaseSource.APK_NAME = "czyzyk-connect.apk"` w aplikacji i ta sama nazwa w `android-release.yml`; adres pliku dalej składany z repozytorium i tagu.

## Risks / Trade-offs

- Dwie zainstalowane wersje naraz obsługiwałyby te same linki `czyzyk://` (wybór aplikacji) – dlatego instrukcja każe odinstalować starą.
