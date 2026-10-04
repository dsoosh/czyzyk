# @czyzyk/cron

Web Push for the family: the evening digest ("Jutro: …") and immediate alerts.

- **Digest** – a pg-boss schedule runs every 5 minutes; users whose chosen hour
  (Europe/Warsaw, `push_settings.digest_time`) has come are claimed for the day
  (`digest_sent_on`) and get tomorrow's items. Empty days are skipped.
- **Alerts** – the worker enqueues `push-alert` jobs (`@czyzyk/shared` → `PUSH_ALERT_QUEUE`)
  after an extraction commits; this service checks the item still qualifies, records it in
  `push_alerts_sent` (one alert per item and kind) and sends it.
- Expired subscriptions (404/410 from the push service) are deleted.
- Logs carry counts only, never notification text.

```bash
cp .env.example .env              # DATABASE_URL, VAPID_* (npm run vapid:generate)
npm run dev -w @czyzyk/cron
npx vitest run --project db services/cron
```
