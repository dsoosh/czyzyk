/**
 * pg-boss polls its job table per queue (default every 2 s). Each poll is a round trip to
 * Supabase, which shows up as Railway egress, so queues poll far less often:
 * - extraction: new messages are already announced by LISTEN (extraction/listen.ts) and wait
 *   EXTRACTION_DELAY_SECONDS anyway, so a 10 s poll keeps the start within ~25 s;
 * - everything else (minute scan, digest every 5 min, push alerts) tolerates 30 s.
 */
export const EXTRACTION_POLL_SECONDS = 10;
export const BACKGROUND_POLL_SECONDS = 30;
