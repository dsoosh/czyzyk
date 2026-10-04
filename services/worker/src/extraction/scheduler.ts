import type pg from "pg";

/**
 * Groups whose newest unprocessed message arrived at least `debounceMinutes` ago.
 * Uses arrival time (received_at), not sent_at: an offline phone may deliver old messages late.
 */
export async function findDueGroups(db: Pick<pg.Pool, "query">, debounceMinutes: number, now: Date): Promise<string[]> {
  const { rows } = await db.query<{ group_id: string }>(
    `select group_id
       from public.messages
      where processed_at is null and status = 'active'
      group by group_id
     having max(received_at) <= $1::timestamptz - make_interval(secs => $2)
      order by min(received_at)`,
    [now, debounceMinutes * 60],
  );
  return rows.map((r) => r.group_id);
}
