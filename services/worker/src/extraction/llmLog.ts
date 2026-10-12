import type pg from "pg";
import type { Logger } from "pino";

/** Entries older than this are removed from the admin's LLM call log (llm-call-log). */
const LLM_LOG_RETENTION_DAYS = 14;

export interface LlmCallEntry {
  kind: "extraction" | "document" | "triage";
  groupId: string;
  /** Messages the call was about (the new messages of a batch, the message of a document). */
  messageIds?: string[];
  model: string | null;
  /** What went to the model; images are listed by label, never stored again here. */
  request: { system: string; user: string; images?: string[] };
  response?: unknown;
  error?: string;
  usage?: unknown;
  durationMs: number;
}

/**
 * Stores one model call for the admin's log. The log holds message content and is readable by
 * admins only; failing to write it never stops the work (and logs no content).
 */
export async function logLlmCall(db: Pick<pg.Pool, "query">, logger: Logger, entry: LlmCallEntry): Promise<string | null> {
  try {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.llm_calls (kind, group_id, model, request, response, error, usage, duration_ms, message_ids)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid[]) returning id`,
      [
        entry.kind,
        entry.groupId,
        entry.model,
        entry.request,
        entry.response ?? null,
        entry.error ?? null,
        entry.usage ?? null,
        entry.durationMs,
        entry.messageIds ?? [],
      ],
    );
    await db.query("delete from public.llm_calls where created_at < now() - make_interval(days => $1)", [LLM_LOG_RETENTION_DAYS]);
    return rows[0]?.id ?? null;
  } catch (error) {
    logger.warn({ groupId: entry.groupId, error: error instanceof Error ? error.name : "Error" }, "llm call log failed");
    return null;
  }
}

/** Records what was applied from the logged answer (counts, rejected operations); best effort. */
export async function logLlmOutcome(db: Pick<pg.Pool, "query">, logger: Logger, id: string | null, outcome: unknown): Promise<void> {
  if (!id) return;
  try {
    await db.query("update public.llm_calls set outcome = $2 where id = $1", [id, outcome]);
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.name : "Error" }, "llm call outcome log failed");
  }
}

/** "Name: reason" of a failed call, without any content. */
export function errorLabel(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error";
  const reason = (error as { reason?: string; status?: number }).reason ?? (error as { status?: number }).status;
  return reason === undefined ? name : `${name}: ${reason}`;
}
