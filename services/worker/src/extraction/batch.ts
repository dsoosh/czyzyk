import type { ContactRoleRow } from "@czyzyk/shared";
import { CHILD_ITEM_TYPES, type ItemData, type ItemType } from "@czyzyk/shared";
import type pg from "pg";

export interface BatchMessage {
  id: string;
  author: string;
  sentAt: Date;
  text: string;
  hasAttachment: boolean;
  /** Documents the phone found among the message's photos (document-import), checked by the server. */
  documents?: BatchDocument[];
}

export interface BatchDocument {
  fileName: string;
  /** Text read on the phone; null when there was none. */
  text: string | null;
  /** The image itself goes to the model (only for new messages). */
  hasImage: boolean;
}

/** A document image given to the model next to the new messages. */
export interface BatchImage {
  messageId: string;
  fileName: string;
  /** JPEG, base64. */
  data: string;
}

/** Images per extraction call: documents are few, this only bounds a burst. */
export const MAX_BATCH_IMAGES = 5;

export interface ExistingItem<T extends ItemType = ItemType> {
  id: string;
  type: T;
  status: "active" | "needs_review" | "cancelled";
  data: ItemData[T];
  /** Names of the children the item is assigned to (empty: the whole group). */
  children: string[];
  /** Set for an item of another group (shared-items): the model may only join it. */
  groupName?: string;
}

export interface FamilyChild {
  name: string;
  /** Other forms of the name: nicknames, full form ("Eleonora", "Elcia"). */
  aliases: string[];
  /** Display name of the child's group, or null when not set. */
  group: string | null;
}

export interface ExtractionBatch {
  group: { id: string; name: string };
  /** Unprocessed messages, oldest first. */
  newMessages: BatchMessage[];
  /** Earlier, already processed messages, oldest first. */
  contextMessages: BatchMessage[];
  /**
   * Already processed messages written after the first new one, oldest first – non-empty when
   * an older message is analysed again (replies and corrections that came after it).
   */
  laterMessages: BatchMessage[];
  /** Current and future items of this group and of the whole kindergarten. */
  items: ExistingItem[];
  /**
   * Active items of the family's other children's groups (shared-items): the same trip or
   * payment announced in two groups is joined instead of created twice.
   */
  otherItems?: ExistingItem[];
  /** Children of the family, so the model can tell which child a message is about. */
  children: FamilyChild[];
  /** Description of the kindergarten written by the family admin (empty when not set). */
  kindergarten: string;
  /** First names of the family members. */
  family: string[];
  /** The admin's extraction prompt template, or null for the default (llm-prompts). */
  promptTemplate: string | null;
  /** Roles of message authors set by the family (contact-roles). */
  contactRoles: ContactRoleRow[];
  /** Document images of the new messages (document-import). */
  images?: BatchImage[];
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
      'whole_kindergarten', t.group_id is null,
      'repeat', case when t.repeat_weekdays is null then null
                     else jsonb_build_object('weekdays', to_jsonb(t.repeat_weekdays), 'until', to_char(t.repeat_until, 'YYYY-MM-DD')) end) as data,
      coalesce(array(select c.name from public.children c where c.id = any(t.child_ids) order by c.name), '{}') as children,
      t.group_id
    from public.events t`,
  bring_item: `select t.id, t.status, jsonb_build_object(
      'description', t.description,
      'due_date', to_char(t.due_date, 'YYYY-MM-DD'),
      'event', t.event_id) as data,
      coalesce(array(select c.name from public.children c where c.id = any(t.child_ids) order by c.name), '{}') as children,
      t.group_id
    from public.bring_items t`,
  payment: `select t.id, t.status, jsonb_build_object(
      'description', t.description,
      'amount_pln', t.amount_pln::float8,
      'due_date', to_char(t.due_date, 'YYYY-MM-DD')) as data,
      coalesce(array(select c.name from public.children c where c.id = any(t.child_ids) order by c.name), '{}') as children,
      t.group_id
    from public.payments t`,
  action_required: `select t.id, t.status, jsonb_build_object(
      'question', t.question,
      'due_date', to_char(t.due_date, 'YYYY-MM-DD'),
      'suggestions', t.suggested_actions) as data,
      coalesce(array(select c.name from public.children c where c.id = any(t.child_ids) order by c.name), '{}') as children,
      t.group_id
    from public.action_required t`,
  closure: `select t.id, t.status, jsonb_build_object(
      'date_from', to_char(t.date_from, 'YYYY-MM-DD'),
      'date_to', to_char(t.date_to, 'YYYY-MM-DD'),
      'reason', t.reason) as data,
      '{}'::text[] as children
    from public.closures t`,
  fact: `select t.id, t.status, jsonb_build_object('category', t.category, 'label', t.label, 'value', t.value) as data,
      '{}'::text[] as children
    from public.facts t`,
};

/** Which items are still relevant for the model ($1 = group id, $2 = today in Warsaw). */
const ITEM_FILTERS: Record<ItemType, string> = {
  // Recurring events stay in context while they repeat (recurring-events).
  event: `(coalesce(t.ends_at, t.starts_at) >= ($2::date)::timestamp at time zone 'Europe/Warsaw'
           or (t.repeat_weekdays is not null and (t.repeat_until is null or t.repeat_until >= $2::date)))`,
  bring_item: "(t.due_date is null or t.due_date >= $2::date)",
  payment: "(t.paid_at is null or t.due_date >= $2::date)",
  action_required: "(t.resolved_at is null or t.due_date >= $2::date)",
  closure: "t.date_to >= $2::date",
  fact: "$2::date is not null", // facts never expire; references $2 so both queries bind the same parameters
};

export async function loadItem(db: Queryable, type: ItemType, id: string): Promise<ExistingItem | null> {
  const { rows } = await db.query(`${ITEM_DATA_SQL[type]} where t.id = $1`, [id]);
  const row = rows[0];
  return row ? { id: row.id, type, status: row.status, data: row.data, children: row.children } : null;
}

/** Items of other groups per type in the prompt; nearest first. */
const MAX_OTHER_ITEMS = 25;

/**
 * Active items with children (events, things to bring, payments, actions) of the other groups
 * the family's children attend; only when a child of the family attends this group too.
 */
async function loadOtherItems(db: Queryable, groupId: string, today: string): Promise<ExistingItem[]> {
  const { rows: groups } = await db.query<{ id: string; name: string }>(
    `select g.id, coalesce(g.display_name, g.wa_name) as name
       from public.wa_groups g
      where g.tracked and g.id <> $1
        and exists (select 1 from public.children c where c.group_id = g.id)
        and exists (select 1 from public.children c where c.group_id = $1)`,
    [groupId],
  );
  if (groups.length === 0) return [];
  const names = new Map(groups.map((g) => [g.id, g.name]));
  const items: ExistingItem[] = [];
  for (const type of CHILD_ITEM_TYPES) {
    const { rows } = await db.query(
      `${ITEM_DATA_SQL[type]}
        where t.group_id = any($1::uuid[]) and ${ITEM_FILTERS[type]} and t.status = 'active'
        order by t.created_at desc limit ${MAX_OTHER_ITEMS}`,
      [[...names.keys()], today],
    );
    for (const r of rows) {
      items.push({ id: r.id, type, status: r.status, data: r.data, children: r.children, groupName: names.get(r.group_id) });
    }
  }
  return items;
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
  if (newMessages.length === 0) {
    return {
      group,
      newMessages,
      contextMessages: [],
      laterMessages: [],
      items: [],
      children: [],
      kindergarten: "",
      family: [],
      promptTemplate: null,
      contactRoles: [],
    };
  }

  const { rows: earlier } = await db.query(
    `select * from (
       select id, author, sent_at, text, has_attachment from public.messages
        where group_id = $1 and processed_at is not null and status = 'active' and sent_at <= $2
        order by sent_at desc, id desc
        limit $3
     ) m order by sent_at, id`,
    [groupId, newMessages[0]!.sentAt, contextSize],
  );
  const { rows: later } = await db.query(
    `select id, author, sent_at, text, has_attachment from public.messages
      where group_id = $1 and processed_at is not null and status = 'active' and sent_at > $2
      order by sent_at, id
      limit $3`,
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
    for (const r of rows) items.push({ id: r.id, type, status: r.status, data: r.data, children: r.children });
  }

  const otherItems = await loadOtherItems(db, groupId, today);

  const { rows: children } = await db.query<FamilyChild>(
    `select c.name, c.aliases, coalesce(g.display_name, g.wa_name) as "group"
       from public.children c left join public.wa_groups g on g.id = c.group_id
      order by c.name`,
  );

  const { rows: profile } = await db.query<{ content: string }>("select content from public.kindergarten_profile");
  const { rows: family } = await db.query<{ name: string }>(
    `select coalesce(nullif(split_part(btrim(display_name), ' ', 1), ''), split_part(email, '@', 1)) as name
       from public.profiles order by 1`,
  );
  const { rows: prompt } = await db.query<{ template: string }>("select template from public.llm_prompts where key = 'extraction'");
  const { rows: contactRoles } = await db.query<ContactRoleRow>("select author_key, role, label from public.contact_roles");

  const contextMessages = earlier.map(toMessage);
  const laterMessages = later.map(toMessage);
  const all = [...contextMessages, ...newMessages, ...laterMessages];
  const { rows: docs } = await db.query<{ message_id: string; file_name: string; doc_text: string | null; has_image: boolean }>(
    `select a.message_id, a.file_name, a.doc_text, f.attachment_id is not null as has_image
       from public.attachments a left join public.attachment_files f on f.attachment_id = a.id
      where a.message_id = any($1::uuid[]) and a.doc_status = 'ready'
      order by a.created_at, a.id`,
    [all.map((m) => m.id)],
  );
  const { rows: images } = await db.query<{ message_id: string; file_name: string; data: string }>(
    `select a.message_id, a.file_name, translate(encode(f.bytes, 'base64'), chr(10), '') as data
       from public.attachments a join public.attachment_files f on f.attachment_id = a.id
      where a.message_id = any($1::uuid[]) and a.doc_status = 'ready'
      order by a.created_at, a.id
      limit $2`,
    [newMessages.map((m) => m.id), MAX_BATCH_IMAGES],
  );
  const sent = new Set(images.map((i) => `${i.message_id}/${i.file_name}`));
  for (const m of all) {
    const own = docs.filter((d) => d.message_id === m.id);
    if (own.length) {
      m.documents = own.map((d) => ({ fileName: d.file_name, text: d.doc_text, hasImage: sent.has(`${m.id}/${d.file_name}`) }));
    }
  }

  return {
    group,
    newMessages,
    contextMessages,
    laterMessages,
    images: images.map((i) => ({ messageId: i.message_id, fileName: i.file_name, data: i.data })),
    items,
    otherItems,
    children,
    kindergarten: profile[0]?.content ?? "",
    family: family.map((f) => f.name),
    promptTemplate: prompt[0]?.template ?? null,
    contactRoles,
  };
}
