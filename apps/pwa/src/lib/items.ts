import type { ActionSuggestion } from "@czyzyk/shared/extraction";
import { fetchChildren, type Child } from "./children";
import { addDays, startOfWarsawDay } from "./dates";
import { withOccurrences } from "./recurrence";
import type { Db } from "./supabase";

export type ItemKind = "event" | "bring_item" | "payment" | "action_required" | "closure" | "fact";

export const ITEM_TABLES: Record<ItemKind, string> = {
  event: "events",
  bring_item: "bring_items",
  payment: "payments",
  action_required: "action_required",
  closure: "closures",
  fact: "facts",
};

interface Provenance {
  id: string;
  group_id: string | null;
  source_message_ids: string[];
  confidence: number | null;
  rationale: string | null;
  status: "active" | "needs_review" | "cancelled";
  /** Children the item is assigned to (events, bring items, payments, actions). */
  child_ids?: string[];
}

export interface EventItem extends Provenance {
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  /** Recurring events (recurring-events): ISO weekdays, 1 = Monday; null for one-off events. */
  repeat_weekdays?: number[] | null;
  repeat_until?: string | null;
  /** Set on an occurrence of a recurring event (lib/recurrence). */
  occurrence_day?: string;
}
export interface BringItem extends Provenance {
  event_id: string | null;
  description: string;
  due_date: string | null;
  packed_by: string | null;
  packed_at: string | null;
}
export interface Payment extends Provenance {
  description: string;
  amount_pln: number | string | null;
  due_date: string | null;
  paid_by: string | null;
  paid_at: string | null;
}
export interface ActionRequired extends Provenance {
  question: string;
  due_date: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  /** Actions proposed by extraction (action-suggestions); empty for older items. */
  suggested_actions: ActionSuggestion[];
  /** Label of the action that closed the item ("Tak, zapisujemy"), if any. */
  resolution: string | null;
}
export interface Closure extends Provenance {
  date_from: string;
  date_to: string;
  reason: string | null;
}
export interface Group {
  id: string;
  wa_name: string;
  display_name: string | null;
  tracked: boolean;
}

const PROVENANCE = "id, group_id, source_message_ids, confidence, rationale, status";
export const EVENT_COLUMNS = `${PROVENANCE}, child_ids, title, starts_at, ends_at, all_day, location, repeat_weekdays, repeat_until`;
export const BRING_COLUMNS = `${PROVENANCE}, child_ids, event_id, description, due_date, packed_by, packed_at`;
export const PAYMENT_COLUMNS = `${PROVENANCE}, child_ids, description, amount_pln, due_date, paid_by, paid_at`;
export const ACTION_COLUMNS = `${PROVENANCE}, child_ids, question, due_date, resolved_by, resolved_at, suggested_actions, resolution`;
export const CLOSURE_COLUMNS = `${PROVENANCE}, date_from, date_to, reason`;

export async function run<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as T;
}

/** Display names of groups; items without a group belong to the whole kindergarten. */
export async function fetchGroupNames(db: Db): Promise<Map<string, string>> {
  const groups = await run<Group[]>(db.from("wa_groups").select("id, wa_name, display_name, tracked"));
  return new Map(groups.map((g) => [g.id, g.display_name ?? g.wa_name]));
}

/** First names of family members by profile id. */
export async function fetchPeople(db: Db): Promise<Map<string, string>> {
  const rows = await run<{ id: string; email: string; display_name: string | null }[]>(
    db.from("profiles").select("id, email, display_name"),
  );
  return new Map(rows.map((p) => [p.id, (p.display_name?.trim() || p.email.split("@")[0]!).split(/\s+/)[0]!]));
}

export function groupLabel(names: Map<string, string>, groupId: string | null): string {
  return groupId ? (names.get(groupId) ?? "grupa") : "całe przedszkole";
}

export interface TodayData {
  /** Due today: packed in the morning. */
  bringToday: BringItem[];
  /** Due tomorrow to 7 days ahead, by date. */
  bringWeek: BringItem[];
  events: EventItem[];
  payments: Payment[];
  actions: ActionRequired[];
  closures: Closure[];
  groups: Map<string, string>;
  people: Map<string, string>;
  children: Child[];
}

/** Everything the home screen shows; only active items (needs_review stays hidden). */
export async function fetchToday(db: Db, today: string): Promise<TodayData> {
  const [bring, oneOff, recurring, payments, actions, closures, groups, people, children] = await Promise.all([
    run<BringItem[]>(
      db
        .from("bring_items")
        .select(BRING_COLUMNS)
        .eq("status", "active")
        .gte("due_date", today)
        .lte("due_date", addDays(today, 7))
        .order("due_date")
        .order("description"),
    ),
    run<EventItem[]>(
      db
        .from("events")
        .select(EVENT_COLUMNS)
        .eq("status", "active")
        .is("repeat_weekdays", null)
        .gte("starts_at", startOfWarsawDay(today).toISOString())
        .lt("starts_at", startOfWarsawDay(addDays(today, 8)).toISOString())
        .order("starts_at"),
    ),
    fetchRecurring(db, addDays(today, 7)),
    run<Payment[]>(
      db
        .from("payments")
        .select(PAYMENT_COLUMNS)
        .eq("status", "active")
        .is("paid_at", null)
        .not("due_date", "is", null)
        .lte("due_date", addDays(today, 14))
        .order("due_date"),
    ),
    run<ActionRequired[]>(
      db.from("action_required").select(ACTION_COLUMNS).eq("status", "active").is("resolved_at", null).order("due_date"),
    ),
    run<Closure[]>(
      db
        .from("closures")
        .select(CLOSURE_COLUMNS)
        .eq("status", "active")
        .gte("date_to", today)
        .lte("date_from", addDays(today, 7))
        .order("date_from"),
    ),
    fetchGroupNames(db),
    fetchPeople(db),
    fetchChildren(db),
  ]);
  return {
    bringToday: bring.filter((b) => b.due_date === today),
    bringWeek: bring.filter((b) => b.due_date !== today),
    events: withOccurrences(oneOff, recurring, closures, today, addDays(today, 7)),
    payments,
    actions,
    closures,
    groups,
    people,
    children,
  };
}

export interface CalendarData {
  events: EventItem[];
  closures: Closure[];
  groups: Map<string, string>;
}

/** Active events and closures between two days (inclusive). */
export async function fetchCalendar(db: Db, fromDay: string, toDay: string): Promise<CalendarData> {
  const [oneOff, recurring, closures, groups] = await Promise.all([
    run<EventItem[]>(
      db
        .from("events")
        .select(EVENT_COLUMNS)
        .eq("status", "active")
        .is("repeat_weekdays", null)
        .gte("starts_at", startOfWarsawDay(fromDay).toISOString())
        .lt("starts_at", startOfWarsawDay(addDays(toDay, 1)).toISOString())
        .order("starts_at")
        .limit(500),
    ),
    fetchRecurring(db, toDay),
    run<Closure[]>(
      db
        .from("closures")
        .select(CLOSURE_COLUMNS)
        .eq("status", "active")
        .gte("date_to", fromDay)
        .lte("date_from", toDay)
        .order("date_from"),
    ),
    fetchGroupNames(db),
  ]);
  return { events: withOccurrences(oneOff, recurring, closures, fromDay, toDay), closures, groups };
}

/** Active recurring events that start by `toDay` (lib/recurrence expands and trims them). */
function fetchRecurring(db: Db, toDay: string): Promise<EventItem[]> {
  return run<EventItem[]>(
    db
      .from("events")
      .select(EVENT_COLUMNS)
      .eq("status", "active")
      .not("repeat_weekdays", "is", null)
      .lt("starts_at", startOfWarsawDay(addDays(toDay, 1)).toISOString())
      .limit(200),
  );
}

export async function fetchEvent(db: Db, id: string) {
  const [event, bring, groups] = await Promise.all([
    run<EventItem | null>(db.from("events").select(EVENT_COLUMNS).eq("id", id).maybeSingle()),
    run<BringItem[]>(db.from("bring_items").select(BRING_COLUMNS).eq("event_id", id).eq("status", "active").order("due_date")),
    fetchGroupNames(db),
  ]);
  return { event, bring, groups };
}

export interface ContextMessage {
  id: string;
  group_id: string;
  author: string;
  sent_at: string;
  text: string;
  has_attachment: boolean;
  status: string;
  /** Which triage step skipped the message (message-triage); null once analysed. */
  triage?: "rules" | "model" | null;
}

/** One entry of an item's history (item-history). */
export interface ItemChange {
  id: string;
  op: "create" | "update" | "cancel";
  /** create: the data; update: {field: {from, to}}; cancel: null. */
  changes: Record<string, unknown> | null;
  source_message_ids: string[];
  rationale: string | null;
  created_at: string;
}

export interface SourceData {
  item: (Provenance & Record<string, unknown>) | null;
  /** Conversation around the newest source message. */
  messages: ContextMessage[];
  history: ItemChange[];
  /** Every source message of the item and of its history, oldest first. */
  sources: ContextMessage[];
}

const SOURCE_COLUMNS = "id, group_id, author, sent_at, text, has_attachment, status";

export async function fetchSource(db: Db, kind: ItemKind, id: string, before: number): Promise<SourceData> {
  const [item, history] = await Promise.all([
    run<(Provenance & Record<string, unknown>) | null>(db.from(ITEM_TABLES[kind]).select("*").eq("id", id).maybeSingle()),
    run<ItemChange[]>(
      db
        .from("item_changes")
        .select("id, op, changes, source_message_ids, rationale, created_at")
        .eq("item_type", kind)
        .eq("item_id", id)
        .order("created_at", { ascending: true }),
    ),
  ]);
  if (!item) return { item, messages: [], history: [], sources: [] };
  const ids = [...new Set([...(item.source_message_ids ?? []), ...history.flatMap((h) => h.source_message_ids)])];
  if (ids.length === 0) return { item, messages: [], history, sources: [] };
  const sources = await run<ContextMessage[]>(db.from("messages").select(SOURCE_COLUMNS).in("id", ids).order("sent_at", { ascending: true }));
  // The conversation around the newest source: that is where the current state comes from.
  const newest = sources.at(-1)?.id ?? ids[0]!;
  const messages = await run<ContextMessage[]>(db.rpc("message_context", { p_message_id: newest, p_before: before, p_after: 10 }));
  return { item, messages, history, sources };
}

export function confidenceLabel(confidence: number | null): string {
  if (confidence == null) return "nieznana";
  if (confidence >= 0.85) return "wysoka";
  if (confidence >= 0.7) return "średnia";
  return "niska";
}

export function formatAmount(amount: number | string | null): string {
  if (amount == null) return "";
  return `${Number(amount).toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} zł`;
}

export function itemTitle(kind: ItemKind, item: Record<string, unknown>): string {
  const field = { event: "title", bring_item: "description", payment: "description", action_required: "question", closure: "reason", fact: "label" }[kind];
  return String(item[field] ?? (kind === "closure" ? "Dzień wolny" : ""));
}
