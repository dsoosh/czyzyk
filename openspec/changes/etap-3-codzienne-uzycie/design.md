# Design

## Context

Stan po etapie 2: elementy są wyciągane i widoczne tylko do odczytu, elementy o niskiej pewności mają `needs_review`, ale nikt ich nie przegląda. Motywacja: `proposal.md`. Wymagania: `specs/*`.

## Goals / Non-Goals

**Goals:**
- Wszystkie zapisy z klienta przez RPC zgodnie z `data-access-control`.
- Push i iCal działające na Androidzie (Chrome) i iPhonie (PWA na ekranie głównym).

**Non-Goals:**
- Synchronizacja w czasie rzeczywistym (Realtime) – wystarczy odświeżenie przy powrocie i po akcji.

## Decisions

### D1. RPC oznaczeń
`mark_packed(item_id, done bool)`, `mark_paid(...)`, `mark_resolved(...)`: `security definer`, sprawdzenie `is_family()`, ustawienie `*_by = auth.uid()`, `*_at = now()` lub `null`. Bez parametrów pozwalających zmienić inne pola.
- *Alternatywa:* polityki UPDATE ograniczone kolumnami – nie wymuszą `*_by = auth.uid()` bez triggera; RPC jest prostszy w audycie.

### D2. Przegląd i blokada decyzji
`review_item(kind, id, action, patch jsonb)` dla admina; zapisuje `reviewed_by`, `reviewed_at` (nowe kolumny wspólne elementów). Worker przy `update` elementu z `reviewed_at is not null` tworzy propozycję w kolejce zamiast nadpisywać (kolumna `pending_patch jsonb` + `status` pozostaje `active`, a element pojawia się w kolejce przez widok `review_queue`).
- *Alternatywa:* osobna tabela propozycji – czystsza, ale dubluje schematy sześciu typów; `pending_patch` walidowany tym samym zod.

### D3. iCal
Generowanie ręczne (RFC 5545, bez biblioteki – mały podzbiór: `VEVENT`, `DTSTART;VALUE=DATE`, `DTSTART;TZID=Europe/Warsaw`, `VTIMEZONE`, zawijanie linii 75 oktetów). UID = `<id>@czyzyk`. Nagłówki `Cache-Control: private, max-age=900`. Token: hash sha256 w `ical_tokens`, odpowiedź 404 (nie 401) dla nieznanego tokenu.
- *Alternatywa:* biblioteka `ical-generator` – wygodna, ale zależność dla ~80 linii kodu; testy snapshot pilnują formatu.

### D4. Push
`web-push` z VAPID; subskrypcje zapisywane przez `services/api` (sesja Supabase w nagłówku, weryfikacja JWT). `services/cron` co 5 minut wybiera użytkowników, którym właśnie wypada godzina skrótu, i wysyła skrót z blokadą „wysłano dziś” (`digest_sent_on date`). Alerty natychmiastowe: worker po zapisie operacji wstawia zadanie pg-boss `push-alert` z `singletonKey = kind:item_id`; tabela `push_alerts_sent` gwarantuje jednokrotność.
- *Alternatywa:* Supabase Edge Functions + pg_cron – rozproszyłoby logikę poza Railway.

### D5. Onboarding iOS
Wykrycie `navigator.standalone === false` i UA iOS; ekran instrukcji z ilustracją. Przycisk zgody tylko w trybie standalone.

## Risks / Trade-offs

- [Kalendarze klientów odświeżają feed rzadko (Google do 24 h)] → komunikat w UI; alerty push pokrywają pilne zmiany.
- [Push na iOS bywa zawodny] → skrót widoczny też na ekranie „Dziś i jutro”.

## Migration Plan

Migracja `0005_tracking.sql`; nowe zmienne `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; nowa usługa Railway `cron`. Wycofanie: wyłączenie usługi `cron` zatrzymuje push bez wpływu na resztę.
