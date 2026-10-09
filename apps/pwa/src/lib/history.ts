import { run, type ContextMessage, type Group } from "./items";
import type { Db } from "./supabase";

export const HISTORY_PAGE = 20;

const MESSAGE_COLUMNS = "id, group_id, author, sent_at, text, has_attachment, status, triage, processed_at";

export interface GroupSummary {
  id: string;
  name: string;
  last: ContextMessage | null;
}

/** Tracked groups with their newest message, most recently active first. */
export async function fetchTrackedGroups(db: Db): Promise<GroupSummary[]> {
  const groups = await run<Group[]>(db.from("wa_groups").select("id, wa_name, display_name, tracked").eq("tracked", true));
  const summaries = await Promise.all(
    groups.map(async (g) => {
      const rows = await run<ContextMessage[]>(
        db.from("messages").select(MESSAGE_COLUMNS).eq("group_id", g.id).order("sent_at", { ascending: false }).limit(1),
      );
      return { id: g.id, name: g.display_name ?? g.wa_name, last: rows[0] ?? null };
    }),
  );
  return summaries.sort((a, b) => {
    if (!a.last || !b.last) return a.last ? -1 : b.last ? 1 : a.name.localeCompare(b.name, "pl");
    return b.last.sent_at.localeCompare(a.last.sent_at);
  });
}

/** `%`, `_` and `\` typed by the user match literally in ilike. */
export function likePattern(query: string): string {
  return `%${query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export interface GroupHistory {
  group: Group | null;
  /** Oldest first, as in a chat. */
  messages: ContextMessage[];
  /** True when older messages may exist beyond the limit. */
  hasMore: boolean;
}

/** The newest `limit` messages of a group (optionally only those containing `query`). */
export async function fetchGroupHistory(db: Db, groupId: string, limit: number, query = ""): Promise<GroupHistory> {
  let select = db.from("messages").select(MESSAGE_COLUMNS).eq("group_id", groupId);
  if (query.trim()) select = select.ilike("text", likePattern(query));
  const [group, rows] = await Promise.all([
    run<Group | null>(db.from("wa_groups").select("id, wa_name, display_name, tracked").eq("id", groupId).maybeSingle()),
    run<ContextMessage[]>(select.order("sent_at", { ascending: false }).limit(limit + 1)),
  ]);
  return { group, messages: rows.slice(0, limit).reverse(), hasMore: rows.length > limit };
}

/** Admin: send a message back to extraction (e.g. after adding a child's name form). */
export async function reprocessMessage(db: Db, id: string): Promise<void> {
  const { error } = await db.rpc("admin_reprocess_message", { p_id: id });
  if (error) throw new Error(error.message);
}
