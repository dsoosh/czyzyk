import { roleOf, type ContactRoleRow } from "@czyzyk/shared";
import { CHILD_ITEM_TYPES, type ItemData, type ItemType } from "@czyzyk/shared";
import type pg from "pg";

export interface BatchMessage {
  id: string;
  author: string;
  sentAt: Date;
  text: string;
  hasAttachment: boolean;
  /** Pasted by the family (manual-entry), often the full text of a notification cut short. */
  manual?: boolean;
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
  /** Names of the children the item is about, as the analysis wrote them (empty: the whole group). */
  children: string[];
  /** Set for an item of another group (shared-items): the model may only join it. */
  groupName?: string;
}

export interface FamilyChild {
  name: string;
  /** Other forms of the name: nicknames, full form ("Eleonora", "Elcia"). */
  aliases: string[];
}

/**
 * A family using the app, as the analysis sees it (families): its children in this group, so
 * names in messages are written the way the family wrote them, and its members' authorship.
 */
export interface BatchFamily {
  id: string;
  /** Children attending this group (may be empty for a family that only wrote here). */
  children: FamilyChild[];
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
   * Active items of other groups attended by children of the same families (shared-items): the
   * same trip or payment announced in two groups is joined instead of created twice.
   */
  otherItems?: ExistingItem[];
  /**
   * Families with children in this group or members writing here, oldest first; they appear in
   * the request, not in the system prompt (families).
   */
  families: BatchFamily[];
  /** Description of the kindergarten written by the operator (empty when not set). */
  kindergarten: string;
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
      'meeting_point', t.meeting_point,
      'whole_kindergarten', t.group_id is null,
      'repeat', case when t.repeat_weekdays is null then null
                     else jsonb_build_object('weekdays', to_jsonb(t.repeat_weekdays), 'until', to_char(t.repeat_until, 'YYYY-MM-DD')) end) as data,
      t.audience as children,
      t.group_id
    from public.events t`,
  bring_item: `select t.id, t.status, jsonb_build_object(
      'description', t.description,
      'due_date', to_char(t.due_date, 'YYYY-MM-DD'),
      'event', t.event_id) as data,
      t.audience as children,
      t.group_id
    from public.bring_items t`,
  payment: `select t.id, t.status, jsonb_build_object(
      'description', t.description,
      'amount_pln', t.amount_pln::float8,
      'due_date', to_char(t.due_date, 'YYYY-MM-DD')) as data,
      t.audience as children,
      t.group_id
    from public.payments t`,
  action_required: `select t.id, t.status, jsonb_build_object(
      'question', t.question,
      'due_date', to_char(t.due_date, 'YYYY-MM-DD'),
      'suggestions', t.suggested_actions) as data,
      t.audience as children,
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
  // "Done" marks are per family (families), so the shared context keeps items by date: a past
  // due date for 30 days, an undated item for 60 days after it appeared.
  payment: "(case when t.due_date is null then t.created_at >= $2::date - 60 else t.due_date >= $2::date - 30 end)",
  action_required: "(case when t.due_date is null then t.created_at >= $2::date - 60 else t.due_date >= $2::date - 30 end)",
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
 * attended by children of a family that also has a child in this group.
 */
async function loadOtherItems(db: Queryable, groupId: string, today: string): Promise<ExistingItem[]> {
  const { rows: groups } = await db.query<{ id: string; name: string }>(
    `select g.id, coalesce(g.display_name, g.wa_name) as name
       from public.wa_groups g
      where g.tracked and g.id <> $1
        and exists (
          select 1 from public.children c1 join public.children c2 on c2.family_id = c1.family_id
           where c1.group_id = g.id and c2.group_id = $1
        )`,
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

  const toMessage = (r: { id: string; author: string; sent_at: Date; text: string; has_attachment: boolean; source: string }): BatchMessage => ({
    id: r.id,
    author: r.author,
    sentAt: r.sent_at,
    text: r.text,
    hasAttachment: r.has_attachment,
    ...(r.source === "manual" ? { manual: true } : {}),
  });

  const { rows: fresh } = await db.query(
    `select id, author, sent_at, text, has_attachment, source from public.messages
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
      families: [],
      kindergarten: "",
      promptTemplate: null,
      contactRoles: [],
    };
  }

  const { rows: earlier } = await db.query(
    `select * from (
       select id, author, sent_at, text, has_attachment, source from public.messages
        where group_id = $1 and processed_at is not null and status = 'active' and sent_at <= $2
        order by sent_at desc, id desc
        limit $3
     ) m order by sent_at, id`,
    [groupId, newMessages[0]!.sentAt, contextSize],
  );
  const { rows: later } = await db.query(
    `select id, author, sent_at, text, has_attachment, source from public.messages
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

  const { rows: profile } = await db.query<{ content: string }>("select content from public.kindergarten_profile");
  const { rows: prompt } = await db.query<{ template: string }>("select template from public.llm_prompts where key = 'extraction'");
  const { rows: contactRoles } = await db.query<ContactRoleRow>(
    `select r.author_key, r.role, r.label, p.family_id
       from public.contact_roles r left join public.profiles p on p.id = r.profile_id`,
  );
  const { rows: kids } = await db.query<{ family_id: string; name: string; aliases: string[] }>(
    "select family_id, name, aliases from public.children where group_id = $1 order by name",
    [groupId],
  );

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

  // Families with children here, then families whose members wrote in this batch (families).
  const writers = new Set(
    all.flatMap((m) => {
      const role = roleOf(contactRoles, m.author);
      return role?.role === "rodzina" && role.family_id ? [role.family_id] : [];
    }),
  );
  const familyIds = [...new Set([...kids.map((k) => k.family_id), ...writers])];
  const { rows: order } = await db.query<{ id: string }>("select id from public.families where id = any($1::uuid[]) order by created_at, id", [
    familyIds,
  ]);
  const families: BatchFamily[] = order.map((f) => ({
    id: f.id,
    children: kids.filter((k) => k.family_id === f.id).map((k) => ({ name: k.name, aliases: k.aliases })),
  }));

  return {
    group,
    newMessages,
    contextMessages,
    laterMessages,
    images: images.map((i) => ({ messageId: i.message_id, fileName: i.file_name, data: i.data })),
    items,
    otherItems,
    families,
    kindergarten: profile[0]?.content ?? "",
    promptTemplate: prompt[0]?.template ?? null,
    contactRoles,
  };
}
