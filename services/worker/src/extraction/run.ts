import type pg from "pg";
import type { Logger } from "pino";
import { applyOperations, type ApplySummary } from "./apply.js";
import { loadBatch, type ExtractionBatch } from "./batch.js";
import { checkPendingDocuments, type DocumentChecker } from "./documents.js";
import { errorLabel, logLlmCall } from "./llmLog.js";
import { buildTriagePrompt, onlyChatter, type TriageModel } from "./triage.js";
import type { ExtractionModel } from "./model.js";
import { buildExtractionPrompt } from "./prompt.js";
import { resolveOperations } from "./resolve.js";
import { warsawDate } from "./time.js";

export interface ExtractionDeps {
  db: pg.Pool;
  model: ExtractionModel;
  /** Cheap model asked first whether a batch needs the full extraction (message-triage); optional. */
  triage?: TriageModel;
  /** Server-side check of document images (document-import); without it images are removed. */
  documents?: DocumentChecker;
  logger: Logger;
  now: () => Date;
  confidenceThreshold: number;
  contextMessages: number;
  /** Called after commit with items that became or stayed active (e.g. to enqueue push alerts). */
  onActiveItems?: (items: ApplySummary["activeItems"]) => Promise<void>;
}

export type RunResult =
  | { status: "locked" }
  | { status: "nothing_to_do" }
  | { status: "skipped"; messages: number; by: "rules" | "model" }
  | ({ status: "ok"; messages: number } & ApplySummary);

async function logSync(db: pg.Pool | pg.PoolClient, status: string, details: Record<string, unknown>) {
  await db.query("insert into public.sync_log (kind, status, details) values ('extraction', $1, $2)", [status, details]);
}

/**
 * Asks the triage model whether the batch needs the full extraction. Any failure means
 * "analyse it" – triage only saves money, it must never lose a message.
 */
async function triageSaysSkip(deps: ExtractionDeps, batch: ExtractionBatch, groupId: string): Promise<boolean> {
  if (!deps.triage) return false;
  const prompt = buildTriagePrompt(batch);
  const started = Date.now();
  const log = (entry: { response?: unknown; error?: string; usage?: unknown }) =>
    logLlmCall(deps.db, deps.logger, {
      kind: "triage",
      groupId,
      messageIds: batch.newMessages.map((m) => m.id),
      model: deps.triage?.name ?? null,
      request: { system: prompt.system, user: prompt.user },
      ...entry,
      durationMs: Date.now() - started,
    });
  try {
    const verdict = await deps.triage.triage(prompt);
    await log({ response: { relevant: verdict.relevant }, usage: verdict.usage });
    return !verdict.relevant;
  } catch (error) {
    await log({ error: errorLabel(error) });
    deps.logger.warn({ groupId, error: errorLabel(error) }, "triage failed, extracting");
    return false;
  }
}

/**
 * Extracts items from a group's unprocessed messages. A session-level advisory lock
 * keeps two runs for the same group from overlapping. On model failure the messages
 * stay unprocessed and the error propagates, so the queue retries the job.
 * Logs and sync_log carry ids and counts only, never message content.
 */
export async function runGroupExtraction(deps: ExtractionDeps, groupId: string): Promise<RunResult> {
  const client = await deps.db.connect();
  const lockKey = `extract:${groupId}`;
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock(hashtextextended($1, 0)) as locked",
      [lockKey],
    );
    if (!rows[0]?.locked) return { status: "locked" };

    try {
      // Document images are checked before any of them reaches the extraction prompt.
      await checkPendingDocuments(deps.db, deps.documents, groupId, deps.logger);
      const now = deps.now();
      const batch = await loadBatch(client, groupId, warsawDate(now), deps.contextMessages);
      if (!batch || batch.newMessages.length === 0) return { status: "nothing_to_do" };

      // A document that reached the server is always analysed: triage does not see images.
      const hasDocument = batch.newMessages.some((m) => m.documents?.length);
      const skippedBy = hasDocument ? null : onlyChatter(batch) ? "rules" : (await triageSaysSkip(deps, batch, groupId)) ? "model" : null;
      if (skippedBy) {
        const ids = batch.newMessages.map((m) => m.id);
        await client.query("update public.messages set processed_at = now(), triage = $2 where id = any($1::uuid[])", [ids, skippedBy]);
        await logSync(client, "skipped", { group_id: groupId, messages: ids.length, by: skippedBy });
        deps.logger.info({ groupId, messages: ids.length, by: skippedBy }, "extraction skipped by triage");
        return { status: "skipped", messages: ids.length, by: skippedBy };
      }

      const prompt = buildExtractionPrompt(batch, now);
      const request = {
        system: prompt.system,
        user: prompt.user,
        ...(prompt.images?.length ? { images: prompt.images.map((i) => i.label) } : {}),
      };
      const log = (entry: { response?: unknown; error?: string; usage?: unknown }) =>
        logLlmCall(deps.db, deps.logger, {
          kind: "extraction",
          groupId,
          messageIds: prompt.newMessageIds,
          model: deps.model.name ?? null,
          request,
          ...entry,
          durationMs: Date.now() - started,
        });
      const started = Date.now();
      let result;
      try {
        result = await deps.model.extract(prompt);
      } catch (error) {
        const name = error instanceof Error ? error.name : "Error";
        const reason = (error as { reason?: string; status?: number }).reason ?? (error as { status?: number }).status;
        await log({ error: errorLabel(error) });
        await logSync(client, "error", { group_id: groupId, messages: prompt.newMessageIds.length, error: name, reason });
        deps.logger.warn({ groupId, error: name, reason }, "extraction failed");
        throw error;
      }

      await log({ response: { operations: result.operations }, usage: result.usage });

      const { accepted, rejected } = resolveOperations(result.operations, prompt.aliases);
      await client.query("begin");
      try {
        const summary = await applyOperations({ client, groupId, threshold: deps.confidenceThreshold }, accepted);
        summary.rejected = [...rejected, ...summary.rejected].sort((a, b) => a.index - b.index);
        await client.query("update public.messages set processed_at = now(), triage = null where id = any($1::uuid[])", [
          prompt.newMessageIds,
        ]);
        await logSync(client, summary.rejected.length ? "partial" : "ok", {
          group_id: groupId,
          messages: prompt.newMessageIds.length,
          created: summary.created,
          updated: summary.updated,
          cancelled: summary.cancelled,
          needs_review: summary.needsReview,
          rejected: summary.rejected,
          usage: result.usage,
        });
        await client.query("commit");
        deps.logger.info(
          {
            groupId,
            messages: prompt.newMessageIds.length,
            ...summary,
            rejected: summary.rejected.length,
            activeItems: summary.activeItems.length,
          },
          "extraction applied",
        );
        if (summary.activeItems.length && deps.onActiveItems) {
          // Alerts are best effort: the extraction is committed whatever happens here.
          await deps.onActiveItems(summary.activeItems).catch((error: unknown) =>
            deps.logger.warn({ groupId, error: error instanceof Error ? error.name : "Error" }, "alert enqueue failed"),
          );
        }
        return { status: "ok", messages: prompt.newMessageIds.length, ...summary };
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    } finally {
      await client.query("select pg_advisory_unlock(hashtextextended($1, 0))", [lockKey]);
    }
  } finally {
    client.release();
  }
}
