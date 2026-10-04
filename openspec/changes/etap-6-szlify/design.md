# Design

## Context

Stan po etapie 5: wszystkie funkcje działają, `sync_log` i `last_seen_at` są zapisywane od etapów 2–4, ale nigdzie prezentowane. Motywacja: `proposal.md`. Wymagania: `specs/*`.

## Goals / Non-Goals

**Goals:**
- Baner świeżości liczony w bazie, aby był identyczny dla wszystkich.

**Non-Goals:**
- Monitoring infrastruktury (Railway/Supabase) – poza aplikacją.

## Decisions

### D1. Świeżość danych
Widok `sync_freshness` (`security definer` przez funkcję `get_sync_freshness()` dla rodziny) zwraca `max(last_notification_at, last_export_at)` po śledzonych grupach; PWA pyta przy starcie i powrocie na pierwszy plan.
- *Alternatywa:* liczenie w PWA z `wa_groups` – działa, ale duplikuje logikę w cron (alerty).

### D2. Wykrywanie usuniętych
W imporcie: zakres `[min(sent_at), max(sent_at)]` paczki; wiadomości `notification` grupy w tym zakresie bez dopasowania (D4 etapu 4) → `deleted_suspected`; elementy, których wszystkie `source_message_ids` są `deleted_suspected`, → `needs_review` z uzasadnieniem „źródło usunięte z grupy”. Margines 2 minut na krańcach zakresu.
- *Alternatywa:* oznaczanie na podstawie powiadomień „Ta wiadomość została usunięta” – niewiarygodne i zależne od języka.

### D3. Alerty admina
`services/cron` co 15 minut; tabela `admin_alerts_sent(kind, subject_id, sent_at)` dla limitu 24 h.

## Risks / Trade-offs

- [Fałszywe `deleted_suspected` przy różnicy nazw kontaktu] → elementy idą do przeglądu, nie są kasowane; admin zatwierdza.

## Migration Plan

Migracja `0008_polish.sql`; brak zmian niekompatybilnych.
