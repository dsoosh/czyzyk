import type { ItemData, ItemType } from "@czyzyk/shared";
import type pg from "pg";

export interface BatchMessage {
  id: string;
  author: string;
  sentAt: Date;
  text: string;
  hasAttachment: boolean;
}

export interface ExistingItem<T extends ItemType = ItemType> {
  id: string;
  type: T;
  status: "active" | "needs_review" | "cancelled";
  data: ItemData[T];
}

export interface ExtractionBatch {
  group: { id: string; name: string };
  /** Unprocessed messages, oldest first. */
  newMessages: BatchMessage[];
  /** Earlier, already processed messages, oldest first. */
  contextMessages: BatchMessage[];
  /** Current and future items of this group and of the whole kindergarten. */
  items: ExistingItem[];
}

type Queryable = Pick<pg.PoolClient, "query">;

const MAX_NEW_MESSAGES = 200;

/**
 * SQL returning every item type in the shape of its extraction data
 * (local Europe/Warsaw dates), so the model sees the same fields it edits.
 */
export const ITEM_DATA_SQL: Record<ItemType, string> = {
  event: `select t.id, t.status, jsonb_build_object(
      'title', t.title,
      'start', case when t.all_day then to_char(t.starts_at at time zone 'Europe/Warsaw', 'YYYY-MM-DD')
                    else to_char(t.starts_at at time zone 'Europe/Warsaw', 'YYYY-MM-DD"T"HH24:MI') end,
      'end', case when t.ends_at is null then null
                  when t.all_day then to_char(t.ends_at at time zone 'Europe/Warsaw', 'YYYY-MM-DD')
                  else to_char(t.ends_at at time zone 'Europe/Warsaw', 'YYYY-MM-DD"T"HH24:MI') end,
      'all_day', t.all_day,
      'location', t.location,
      'whole_kindergarten', t.group_id is null) as data
    from public.events t`,
  bring_item: `select t.id, t.status, jsonb_build_object(
      'description', t.description,
      'due_date', to_char(t.due_date, 'YYYY-MM-DD'),
      'event', t.event_id) as data
    from public.bring_items t`,
  payment: `select t.id, t.status, jsonb_build_object(
      'description', t.description,
      'amount_pln', t.amount_pln::float8,
      'due_date', to_char(t.due_date, 'YYYY-MM-DD')) as data
    from public.payments t`,
  action_required: `select t.id, t.status, jsonb_build_object(
      'question', t.question,
      'due_date', to_char(t.due_date, 'YYYY-MM-DD')) as data
    from public.action_required t`,
  closure: `select t.id, t.status, jsonb_build_object(
      'date_from', to_char(t.date_from, 'YYYY-MM-DD'),
      'date_to', to_char(t.date_to, 'YYYY-MM-DD'),
      'reason', t.reason) as data
    from public.closures t`,
  fact: `select t.id, t.status, jsonb_build_object('category', t.category, 'label', t.label, 'value', t.value) as data
    from public.facts t`,
};

/** Which items are still relevant for the model ($1 = group id, $2 = today in Warsaw). */
const ITEM_FILTERS: Record<ItemType, string> = {
  event: "coalesce(t.ends_at, t.starts_at) >= ($2::date)::timestamp at time zone 'Europe/Warsaw'",
  bring_item: "(t.due_date is null or t.due_date >= $2::date)",
  payment: "(t.paid_at is null or t.due_date >= $2::date)",
  action_required: "(t.resolved_at is null or t.due_date >= $2::date)",
  closure: "t.date_to >= $2::date",
  fact: "$2::date is not null", // facts never expire; references $2 so both queries bind the same parameters
};

export async function loadItem(db: Queryable, type: ItemType, id: string): Promise<ExistingItem | null> {
  const { rows } = await db.query(`${ITEM_DATA_SQL[type]} where t.id = $1`, [id]);
  const row = rows[0];
  return row ? { id: row.id, type, status: row.status, data: row.data } : null;
}

export async function loadBatch(db: Queryable, groupId: string, today: string, contextSize: number): Promise<ExtractionBatch | null> {
  const { rows: groups } = await db.query<{ id: string; name: string }>(
    "select id, coalesce(display_name, wa_name) as name from public.wa_groups where id = $1",
    [groupId],
  );
  const group = groups[0];
  if (!group) return null;

  const toMessage = (r: { id: string; author: string; sent_at: Date; text: string; has_attachment: boolean }): BatchMessage => ({
    id: r.id,
    author: r.author,
    sentAt: r.sent_at,
    text: r.text,
    hasAttachment: r.has_attachment,
  });

  const { rows: fresh } = await db.query(
    `select id, author, sent_at, text, has_attachment from public.messages
      where group_id = $1 and processed_at is null and status = 'active'
      order by sent_at, id
      limit $2`,
    [groupId, MAX_NEW_MESSAGES],
  );
  const newMessages = fresh.map(toMessage);
  if (newMessages.length === 0) return { group, newMessages, contextMessages: [], items: [] };

  const { rows: earlier } = await db.query(
    `select * from (
       select id, author, sent_at, text, has_attachment from public.messages
        where group_id = $1 and processed_at is not null and status = 'active' and sent_at <= $2
        order by sent_at desc, id desc
        limit $3
     ) m order by sent_at, id`,
    [groupId, newMessages[0]!.sentAt, contextSize],
  );

  const items: ExistingItem[] = [];
  for (const type of Object.keys(ITEM_DATA_SQL) as ItemType[]) {
    const { rows } = await db.query(
      `${ITEM_DATA_SQL[type]}
        where (t.group_id = $1 or t.group_id is null) and ${ITEM_FILTERS[type]}
          and t.status in ('active', 'needs_review')
        order by t.created_at limit 100`,
      [groupId, today],
    );
    for (const r of rows) items.push({ id: r.id, type, status: r.status, data: r.data });
  }

  return { group, newMessages, contextMessages: earlier.map(toMessage), items };
}
