import { CHILD_ITEM_TYPES, itemDataSchemas, type ItemData, type ItemType } from "@czyzyk/shared";
import type pg from "pg";
import { loadItem } from "./batch.js";
import type { EventRef, Rejection, ResolvedOperation } from "./resolve.js";

type Status = "active" | "needs_review" | "cancelled";

export interface ApplySummary {
  created: number;
  updated: number;
  cancelled: number;
  needsReview: number;
  rejected: Rejection[];
  /** Items created or updated as active (ids only); the worker turns some into push alerts. */
  activeItems: { type: ItemType; id: string }[];
}

interface Ctx {
  client: pg.PoolClient;
  groupId: string;
  threshold: number;
}

/** Converts a local Europe/Warsaw date or date-time (bound as $n) to timestamptz. */
const localTs = (value: string, allDay: string) =>
  `case when ${value}::text is null then null
        when ${allDay} then (left(${value}::text, 10)::date)::timestamp at time zone 'Europe/Warsaw'
        else (${value}::text::timestamp) at time zone 'Europe/Warsaw' end`;

const TABLE: Record<ItemType, string> = {
  event: "public.events",
  bring_item: "public.bring_items",
  payment: "public.payments",
  action_required: "public.action_required",
  closure: "public.closures",
  fact: "public.facts",
};

/** Column assignments for each type, as [column, sql expression, value] (values bound in order). */
function columns(type: ItemType, data: ItemData[ItemType], groupId: string, eventId: string | null): [string, string, unknown][] {
  switch (type) {
    case "event": {
      const d = data as ItemData["event"];
      return [
        ["group_id", "$", d.whole_kindergarten ? null : groupId],
        ["title", "$", d.title],
        ["all_day", "$", d.all_day],
        ["starts_at", "starts", d.start],
        ["ends_at", "ends", d.end],
        ["location", "$", d.location],
      ];
    }
    case "bring_item": {
      const d = data as ItemData["bring_item"];
      return [
        ["group_id", "$", groupId],
        ["description", "$", d.description],
        ["due_date", "$::date", d.due_date],
        ["event_id", "$::uuid", eventId],
      ];
    }
    case "payment": {
      const d = data as ItemData["payment"];
      return [
        ["group_id", "$", groupId],
        ["description", "$", d.description],
        ["amount_pln", "$::numeric", d.amount_pln],
        ["due_date", "$::date", d.due_date],
      ];
    }
    case "action_required": {
      const d = data as ItemData["action_required"];
      return [
        ["group_id", "$", groupId],
        ["question", "$", d.question],
        ["due_date", "$::date", d.due_date],
        // Absent in an update: the stored suggestions stay (action-suggestions).
        ...(d.suggestions ? [["suggested_actions", "$::jsonb", JSON.stringify(d.suggestions)] as [string, string, unknown]] : []),
      ];
    }
    case "closure": {
      const d = data as ItemData["closure"];
      return [
        ["group_id", "$", groupId],
        ["date_from", "$::date", d.date_from],
        ["date_to", "$::date", d.date_to],
        ["reason", "$", d.reason],
      ];
    }
    case "fact": {
      const d = data as ItemData["fact"];
      return [
        ["group_id", "$", groupId],
        ["category", "$", d.category],
        ["label", "$", d.label],
        ["value", "$", d.value],
      ];
    }
  }
}

/** Renders column expressions with positional parameters starting at `offset + 1`. */
function render(cols: [string, string, unknown][], offset: number) {
  const params: unknown[] = [];
  const exprs: string[] = [];
  const allDayIndex = cols.findIndex(([c]) => c === "all_day");
  for (const [, expr, value] of cols) {
    params.push(value);
    const p = `$${offset + params.length}`;
    if (expr === "starts" || expr === "ends") exprs.push(localTs(p, `$${offset + allDayIndex + 1}::boolean`));
    else exprs.push(expr.replace("$", p));
  }
  return { names: cols.map(([c]) => c), exprs, params };
}

function statusFor(op: ResolvedOperation, threshold: number): Status {
  if (op.confidence < threshold) return "needs_review";
  return op.op === "cancel" ? "cancelled" : "active";
}

function checkData(type: ItemType, data: unknown): ItemData[ItemType] {
  // The event link is resolved separately (alias/ref → id), so it is not part of the stored data check.
  const schema = type === "bring_item" ? itemDataSchemas.bring_item.omit({ event: true }) : itemDataSchemas[type];
  let input = data;
  if (type === "bring_item" && data && typeof data === "object") {
    const { event: _event, ...rest } = data as Record<string, unknown>;
    input = rest;
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ApplyRejection(`invalid data: ${parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"} ${i.code}`).join(", ")}`);
  const value = parsed.data as Record<string, unknown>;
  if (type === "event" && value.end && String(value.end).slice(0, 16) < String(value.start).slice(0, 16)) {
    throw new ApplyRejection("event ends before it starts");
  }
  if (type === "closure" && String(value.date_to) < String(value.date_from)) {
    throw new ApplyRejection("closure ends before it starts");
  }
  return value as ItemData[ItemType];
}

class ApplyRejection extends Error {}

/**
 * Child names as the model wrote them → ids, by name or another form of it ("Elcia");
 * unknown names are dropped, the item still counts.
 */
async function childIds(client: pg.PoolClient, names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const { rows } = await client.query<{ id: string }>(
    `select id from public.children
      where public.child_name_forms(name, aliases) && array(select lower(btrim(n)) from unnest($1::text[]) n)
      order by name`,
    [names],
  );
  return rows.map((r) => r.id);
}

const takesChildren = (type: ItemType) => (CHILD_ITEM_TYPES as readonly ItemType[]).includes(type);

/**
 * Applies operations inside the caller's transaction. Each operation runs in its own
 * savepoint, so one bad operation is rejected without losing the others.
 */
export async function applyOperations(ctx: Ctx, operations: ResolvedOperation[]): Promise<ApplySummary> {
  const summary: ApplySummary = { created: 0, updated: 0, cancelled: 0, needsReview: 0, rejected: [], activeItems: [] };
  const refIds = new Map<string, string>();

  // Events first, so bring items created in the same answer can point at them.
  const ordered = [
    ...operations.filter((o) => o.op === "create" && o.type === "event"),
    ...operations.filter((o) => !(o.op === "create" && o.type === "event")),
  ];

  for (const op of ordered) {
    await ctx.client.query("savepoint op");
    try {
      const status = statusFor(op, ctx.threshold);
      const outcome = await applyOne(ctx, op, status, refIds);
      await ctx.client.query("release savepoint op");
      if (outcome !== "proposed" && status === "active") {
        summary.activeItems.push({ type: op.type, id: outcome.id });
      }
      if (outcome === "proposed" || status === "needs_review") summary.needsReview++;
      else if (op.op === "create") summary.created++;
      else if (op.op === "update") summary.updated++;
      else summary.cancelled++;
    } catch (error) {
      await ctx.client.query("rollback to savepoint op");
      const reason =
        error instanceof ApplyRejection
          ? error.message
          : `database error ${(error as { code?: string }).code ?? "unknown"}`;
      summary.rejected.push({ index: op.index, reason });
    }
  }
  return summary;
}

/** Stores the change as pending_patch (same field names as extraction data) for the admin to accept or dismiss. */
async function queueProposal(client: pg.PoolClient, table: string, op: Extract<ResolvedOperation, { op: "update" | "cancel" }>) {
  let data: Record<string, unknown> | undefined;
  if (op.op === "update") {
    // Validated against the type's schema; the event link is not part of a reviewable patch.
    const { event: _event, ...rest } = op.data as Record<string, unknown>;
    const parsed = itemDataSchemas[op.type].partial().safeParse(rest);
    if (!parsed.success) throw new ApplyRejection("invalid proposal data");
    data = parsed.data as Record<string, unknown>;
  }
  const proposal = {
    op: op.op,
    ...(data ? { data } : {}),
    confidence: op.confidence,
    rationale: op.rationale,
    source_message_ids: op.sourceMessageIds,
  };
  await client.query(`update ${table} set pending_patch = $2 where id = $1`, [op.targetId, proposal]);
}

async function applyOne(
  ctx: Ctx,
  op: ResolvedOperation,
  status: Status,
  refIds: Map<string, string>,
): Promise<{ id: string } | "proposed"> {
  const { client, groupId } = ctx;
  const table = TABLE[op.type];
  const meta = [op.sourceMessageIds, op.confidence, op.rationale, status] as const;

  const eventIdOf = (ref: EventRef | undefined) => {
    if (!ref) return null;
    if (ref.kind === "existing") return ref.id;
    const id = refIds.get(ref.ref);
    if (!id) throw new ApplyRejection(`event ref ${ref.ref} was not created`);
    return id;
  };

  if (op.op === "create") {
    const data = checkData(op.type, op.data);
    const assigned: [string, string, unknown][] = takesChildren(op.type) ? [["child_ids", "$::uuid[]", await childIds(client, op.children)]] : [];
    const cols = render([...columns(op.type, data, groupId, eventIdOf(op.eventRef)), ...assigned], 4);
    const { rows } = await client.query<{ id: string }>(
      `insert into ${table} (source_message_ids, confidence, rationale, status, ${cols.names.join(", ")})
       values ($1::uuid[], $2, $3, $4, ${cols.exprs.join(", ")})
       returning id`,
      [...meta, ...cols.params],
    );
    if (op.ref) refIds.set(op.ref, rows[0]!.id);
    return { id: rows[0]!.id };
  }

  const existing = await loadItem(client, op.type, op.targetId);
  if (!existing) throw new ApplyRejection("target item no longer exists");

  // Filling in suggested actions (action-suggestions) changes nothing the family or an admin
  // decided: store them directly, keeping status, confidence and any review.
  if (op.op === "update" && op.type === "action_required" && op.children.length === 0) {
    const keys = Object.keys(op.data as Record<string, unknown>);
    if (keys.length === 1 && keys[0] === "suggestions") {
      const { suggestions } = checkData("action_required", { ...(existing.data as object), ...(op.data as object) }) as ItemData["action_required"];
      await client.query("update public.action_required set suggested_actions = $2::jsonb where id = $1", [
        op.targetId,
        JSON.stringify(suggestions ?? []),
      ]);
      return { id: op.targetId };
    }
  }

  // An admin already decided about this item: never overwrite, queue a proposal instead.
  const { rows: reviewed } = await client.query<{ reviewed: boolean }>(
    `select reviewed_at is not null as reviewed from ${table} where id = $1`,
    [op.targetId],
  );
  if (reviewed[0]?.reviewed) {
    await queueProposal(client, table, op);
    return "proposed";
  }

  if (op.op === "cancel") {
    await client.query(
      `update ${table}
          set source_message_ids = array(select distinct unnest(source_message_ids || $2::uuid[])),
              confidence = $3, rationale = $4, status = $5
        where id = $1`,
      [op.targetId, ...meta],
    );
    return { id: op.targetId };
  }

  const merged = { ...(existing.data as Record<string, unknown>), ...(op.data as Record<string, unknown>) };
  const data = checkData(op.type, merged);
  const currentEvent = op.type === "bring_item" ? ((existing.data as { event: string | null }).event ?? null) : null;
  const eventId = op.eventRef === undefined ? currentEvent : eventIdOf(op.eventRef);
  // Only events move between "this group" and "whole kindergarten"; other items keep their group.
  const updatable = columns(op.type, data, groupId, eventId).filter(([name]) => op.type === "event" || name !== "group_id");
  // An empty list keeps the current assignment; names that match no child do not clear it either.
  const ids = takesChildren(op.type) ? await childIds(client, op.children) : [];
  if (ids.length) updatable.push(["child_ids", "$::uuid[]", ids]);
  const cols = render(updatable, 5);
  const assignments = cols.names.map((name, i) => `${name} = ${cols.exprs[i]}`).join(", ");
  await client.query(
    `update ${table}
        set source_message_ids = array(select distinct unnest(source_message_ids || $2::uuid[])),
            confidence = $3, rationale = $4, status = $5, ${assignments}
      where id = $1`,
    [op.targetId, ...meta, ...cols.params],
  );
  return { id: op.targetId };
}
