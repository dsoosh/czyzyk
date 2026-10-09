import { fetchChildren, type Child } from "./children";
import { dayLabel, warsawDay, warsawTime } from "./dates";
import {
  ACTION_COLUMNS,
  BRING_COLUMNS,
  CLOSURE_COLUMNS,
  fetchGroupNames,
  fetchPeople,
  ITEM_TABLES,
  PAYMENT_COLUMNS,
  run,
  type ActionRequired,
  type BringItem,
  type Closure,
  type Payment,
} from "./items";
import type { Db } from "./supabase";

export type TrackedKind = "bring_item" | "payment" | "action_required";

const MARK_RPC: Record<TrackedKind, string> = {
  bring_item: "mark_packed",
  payment: "mark_paid",
  action_required: "mark_resolved",
};

/** Marks an item as done by the current user (or clears the mark); the database records who and when. */
export async function markDone(db: Db, kind: TrackedKind, id: string, done: boolean): Promise<void> {
  const { error } = await db.rpc(MARK_RPC[kind], { p_id: id, p_done: done });
  if (error) throw new Error(error.message);
}

/**
 * "spakowane przez Ciebie, 20:15" or "spakowane: Ola, wczoraj 20:15".
 * Gender-neutral on purpose: names say nothing reliable about grammatical gender.
 */
export function doneLabel(
  verb: string,
  by: string | null,
  at: string,
  me: string,
  people: Map<string, string>,
  today: string,
): string {
  const day = warsawDay(at);
  const when = day === today ? warsawTime(at) : `${dayLabel(day, today)} ${warsawTime(at)}`;
  if (by === me) return `${verb} przez Ciebie, ${when}`;
  const who = by ? (people.get(by) ?? "ktoś z rodziny") : "ktoś z rodziny";
  return `${verb}: ${who}, ${when}`;
}

export interface ListsBase {
  groups: Map<string, string>;
  people: Map<string, string>;
  children: Child[];
}

/** Upcoming (and undated) things to bring, soonest first. */
export async function fetchBringList(db: Db, today: string): Promise<ListsBase & { items: BringItem[] }> {
  const [dated, undated, groups, people, children] = await Promise.all([
    run<BringItem[]>(
      db.from(ITEM_TABLES.bring_item).select(BRING_COLUMNS).eq("status", "active").gte("due_date", today).order("due_date").order("description"),
    ),
    run<BringItem[]>(
      db.from(ITEM_TABLES.bring_item).select(BRING_COLUMNS).eq("status", "active").is("due_date", null).order("description").limit(50),
    ),
    fetchGroupNames(db),
    fetchPeople(db),
    fetchChildren(db),
  ]);
  return { items: [...dated, ...undated], groups, people, children };
}

export async function fetchPaymentList(db: Db): Promise<ListsBase & { open: Payment[]; paid: Payment[] }> {
  const [open, paid, groups, people, children] = await Promise.all([
    run<Payment[]>(db.from(ITEM_TABLES.payment).select(PAYMENT_COLUMNS).eq("status", "active").is("paid_at", null).order("due_date")),
    run<Payment[]>(
      db
        .from(ITEM_TABLES.payment)
        .select(PAYMENT_COLUMNS)
        .eq("status", "active")
        .not("paid_at", "is", null)
        .order("paid_at", { ascending: false })
        .limit(50),
    ),
    fetchGroupNames(db),
    fetchPeople(db),
    fetchChildren(db),
  ]);
  return { open, paid, groups, people, children };
}

export async function fetchActionList(db: Db): Promise<ListsBase & { open: ActionRequired[]; resolved: ActionRequired[] }> {
  const [open, resolved, groups, people, children] = await Promise.all([
    run<ActionRequired[]>(
      db.from(ITEM_TABLES.action_required).select(ACTION_COLUMNS).eq("status", "active").is("resolved_at", null).order("due_date"),
    ),
    run<ActionRequired[]>(
      db
        .from(ITEM_TABLES.action_required)
        .select(ACTION_COLUMNS)
        .eq("status", "active")
        .not("resolved_at", "is", null)
        .order("resolved_at", { ascending: false })
        .limit(50),
    ),
    fetchGroupNames(db),
    fetchPeople(db),
    fetchChildren(db),
  ]);
  return { open, resolved, groups, people, children };
}

export async function fetchClosureList(db: Db, today: string): Promise<{ closures: Closure[]; groups: Map<string, string> }> {
  const [closures, groups] = await Promise.all([
    run<Closure[]>(db.from("closures").select(CLOSURE_COLUMNS).eq("status", "active").gte("date_to", today).order("date_from")),
    fetchGroupNames(db),
  ]);
  return { closures, groups };
}

/** Overdue unpaid first, then by due date; undated last. */
export function sortOpenPayments(payments: Payment[], today: string): Payment[] {
  const rank = (p: Payment) => (p.due_date == null ? 2 : p.due_date < today ? 0 : 1);
  return [...payments].sort(
    (a, b) => rank(a) - rank(b) || (a.due_date ?? "").localeCompare(b.due_date ?? "") || a.description.localeCompare(b.description),
  );
}
