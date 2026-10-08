import { ITEM_TABLES, itemTitle, run, type ContextMessage, type ItemKind } from "./items";
import type { Db } from "./supabase";

/** An item the message created or changed (message-details). */
export interface MessageItem {
  kind: ItemKind;
  id: string;
  title: string;
  status: string;
  /** What the message did to it: created, changed, cancelled; empty when only its source. */
  ops: ("create" | "update" | "cancel")[];
}

/** A model call the message went through; admins only (llm-call-log). */
export interface MessageCall {
  id: string;
  kind: "extraction" | "document" | "triage";
  response: { operations?: unknown[]; relevant?: boolean; rationale?: string | null; containsPeople?: boolean } | null;
  error: string | null;
  created_at: string;
}

export interface MessageDetails {
  items: MessageItem[];
  calls: MessageCall[];
}

const TITLE_COLUMNS: Record<ItemKind, string> = {
  event: "id, title, status",
  bring_item: "id, description, status",
  payment: "id, description, status",
  action_required: "id, question, status",
  closure: "id, reason, status",
  fact: "id, label, status",
};

/** What came out of one message: the items it created or changed and, for admins, the model calls. */
export async function fetchMessageDetails(db: Db, messageId: string, admin: boolean): Promise<MessageDetails> {
  const kinds = Object.keys(ITEM_TABLES) as ItemKind[];
  const [changes, direct, calls] = await Promise.all([
    run<{ item_type: ItemKind; item_id: string; op: MessageItem["ops"][number] }[]>(
      db.from("item_changes").select("item_type, item_id, op").contains("source_message_ids", [messageId]).order("created_at"),
    ),
    Promise.all(
      kinds.map(async (kind) =>
        (await run<{ id: string }[]>(db.from(ITEM_TABLES[kind]).select("id").contains("source_message_ids", [messageId]))).map((r) => ({
          kind,
          id: r.id,
        })),
      ),
    ),
    admin
      ? run<MessageCall[]>(
          db.from("llm_calls").select("id, kind, response, error, created_at").contains("message_ids", [messageId]).order("created_at"),
        )
      : Promise.resolve<MessageCall[]>([]),
  ]);

  const byKey = new Map<string, { kind: ItemKind; id: string; ops: MessageItem["ops"] }>();
  const entry = (kind: ItemKind, id: string) => {
    const key = `${kind}:${id}`;
    if (!byKey.has(key)) byKey.set(key, { kind, id, ops: [] });
    return byKey.get(key)!;
  };
  for (const c of changes) if (!entry(c.item_type, c.item_id).ops.includes(c.op)) entry(c.item_type, c.item_id).ops.push(c.op);
  for (const d of direct.flat()) entry(d.kind, d.id);

  const items: MessageItem[] = [];
  for (const kind of kinds) {
    const ids = [...byKey.values()].filter((e) => e.kind === kind).map((e) => e.id);
    if (ids.length === 0) continue;
    const rows = await run<(Record<string, unknown> & { id: string; status: string })[]>(
      db.from(ITEM_TABLES[kind]).select(TITLE_COLUMNS[kind]).in("id", ids),
    );
    for (const row of rows) items.push({ kind, id: row.id, title: itemTitle(kind, row), status: row.status, ops: byKey.get(`${kind}:${row.id}`)!.ops });
  }
  return { items, calls };
}

/** Plain-language verdict of the analysis for one message (message-triage, item-extraction). */
export function verdictLabel(m: Pick<ContextMessage, "triage" | "processed_at" | "status">): string {
  if (m.status === "deleted_suspected") return "Prawdopodobnie usunięta z grupy";
  if (m.processed_at == null) return "Czeka na analizę";
  if (m.triage === "rules") return "Pominięta – sama pogawędka (reguły)";
  if (m.triage === "model") return "Pominięta – wstępna ocena modelu: nic organizacyjnego";
  return "Przeanalizowana";
}
