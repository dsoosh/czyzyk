import { buildSystemPrompt, type AssistantView } from "@czyzyk/shared";
import type pg from "pg";

type Db = Pick<pg.Pool, "query">;

const TZ = "Europe/Warsaw";
const GROUP_HISTORY_MESSAGES = 200;
const EVENT_CONTEXT = 10;
const SOURCE_CONTEXT = 20;

const ITEM_TABLES = {
  event: "events",
  bring_item: "bring_items",
  payment: "payments",
  action_required: "action_required",
  closure: "closures",
  fact: "facts",
} as const;

const WEEKDAY = new Intl.DateTimeFormat("pl-PL", { weekday: "long", timeZone: "UTC" });

/** "2026-10-09" → "piątek 2026-10-09". */
export function dayWithWeekday(day: string): string {
  return `${WEEKDAY.format(new Date(`${day}T12:00:00Z`))} ${day}`;
}

/** Calendar day in Warsaw for an instant. */
export function warsawDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

interface Names {
  groups: Map<string, string>;
  people: Map<string, string>;
  children: { id: string; name: string; group_id: string | null; aliases: string[] }[];
}

async function loadNames(db: Db): Promise<Names> {
  const [groups, people, children] = await Promise.all([
    db.query<{ id: string; name: string }>("select id, coalesce(display_name, wa_name) as name from public.wa_groups"),
    db.query<{ id: string; name: string }>(
      "select id, split_part(coalesce(nullif(trim(display_name), ''), split_part(email, '@', 1)), ' ', 1) as name from public.profiles",
    ),
    db.query<{ id: string; name: string; group_id: string | null; aliases: string[] }>(
      "select id, name, group_id, aliases from public.children order by name",
    ),
  ]);
  return {
    groups: new Map(groups.rows.map((r) => [r.id, r.name])),
    people: new Map(people.rows.map((r) => [r.id, r.name])),
    children: children.rows,
  };
}

const groupOf = (names: Names, id: string | null) => (id ? `grupa ${names.groups.get(id) ?? "?"}` : "całe przedszkole");

/** "; dziecko: Zosia" – assigned children, otherwise the children of the item's group (as in the PWA). */
function childOf(names: Names, row: { group_id: string | null; child_ids: string[] }): string {
  const list = row.child_ids.length
    ? names.children.filter((c) => row.child_ids.includes(c.id))
    : row.group_id
      ? names.children.filter((c) => c.group_id === row.group_id)
      : [];
  return list.length ? `; dziecko: ${list.map((c) => c.name).join(", ")}` : "";
}
const who = (names: Names, id: string | null) => (id ? (names.people.get(id) ?? "ktoś z rodziny") : "ktoś z rodziny");

// --- items ------------------------------------------------------------------

interface EventRow {
  id: string;
  group_id: string | null;
  child_ids: string[];
  title: string;
  start_day: string;
  start_time: string;
  end_day: string | null;
  end_time: string | null;
  all_day: boolean;
  location: string | null;
}

const EVENT_SELECT = `
  select id, group_id, child_ids, title, all_day, location,
         to_char(starts_at at time zone '${TZ}', 'YYYY-MM-DD') as start_day,
         to_char(starts_at at time zone '${TZ}', 'HH24:MI') as start_time,
         to_char(ends_at at time zone '${TZ}', 'YYYY-MM-DD') as end_day,
         to_char(ends_at at time zone '${TZ}', 'HH24:MI') as end_time
    from public.events`;

function eventLine(e: EventRow, names: Names): string {
  let when = dayWithWeekday(e.start_day);
  if (e.all_day) {
    when += e.end_day && e.end_day !== e.start_day ? ` – ${dayWithWeekday(e.end_day)}, całe dni` : ", cały dzień";
  } else {
    when += ` ${e.start_time}`;
    if (e.end_day) when += e.end_day === e.start_day ? `–${e.end_time}` : ` – ${dayWithWeekday(e.end_day)} ${e.end_time}`;
  }
  return `- Wydarzenie: ${e.title}; ${when}${e.location ? `; miejsce: ${e.location}` : ""}; ${groupOf(names, e.group_id)}${childOf(names, e)}`;
}

interface BringRow {
  group_id: string | null;
  child_ids: string[];
  description: string;
  due_date: string | null;
  packed_by: string | null;
  packed_at: Date | null;
  event_title: string | null;
}

const BRING_SELECT = `
  select b.group_id, b.child_ids, b.description, to_char(b.due_date, 'YYYY-MM-DD') as due_date, b.packed_by, b.packed_at, e.title as event_title
    from public.bring_items b
    left join public.events e on e.id = b.event_id and e.status = 'active'`;

function bringLine(b: BringRow, names: Names): string {
  const due = b.due_date ? `na ${dayWithWeekday(b.due_date)}` : "bez terminu";
  const packed = b.packed_at ? `spakowane (${who(names, b.packed_by)})` : "jeszcze nie spakowane";
  return `- Do przyniesienia: ${b.description}; ${due}${b.event_title ? `; na wydarzenie „${b.event_title}”` : ""}; ${packed}; ${groupOf(names, b.group_id)}${childOf(names, b)}`;
}

interface PaymentRow {
  group_id: string | null;
  child_ids: string[];
  description: string;
  amount_pln: string | null;
  due_date: string | null;
  paid_by: string | null;
  paid_at: Date | null;
}

const PAYMENT_SELECT = `
  select group_id, child_ids, description, amount_pln::text, to_char(due_date, 'YYYY-MM-DD') as due_date, paid_by, paid_at
    from public.payments`;

function paymentLine(p: PaymentRow, names: Names): string {
  const amount = p.amount_pln ? `${p.amount_pln.replace(".", ",")} zł` : "kwota nieznana";
  const due = p.due_date ? `termin ${dayWithWeekday(p.due_date)}` : "bez terminu";
  const paid = p.paid_at ? `zapłacone (${who(names, p.paid_by)}, ${warsawDate(p.paid_at)})` : "niezapłacone";
  return `- Płatność: ${p.description}; ${amount}; ${due}; ${paid}; ${groupOf(names, p.group_id)}${childOf(names, p)}`;
}

interface ActionRow {
  group_id: string | null;
  child_ids: string[];
  question: string;
  due_date: string | null;
  resolved_by: string | null;
  resolved_at: Date | null;
}

const ACTION_SELECT = `
  select group_id, child_ids, question, to_char(due_date, 'YYYY-MM-DD') as due_date, resolved_by, resolved_at
    from public.action_required`;

function actionLine(a: ActionRow, names: Names): string {
  const due = a.due_date ? `do ${dayWithWeekday(a.due_date)}` : "bez terminu";
  const done = a.resolved_at ? `załatwione (${who(names, a.resolved_by)})` : "do załatwienia";
  return `- Wymaga odpowiedzi: ${a.question}; ${due}; ${done}; ${groupOf(names, a.group_id)}${childOf(names, a)}`;
}

interface ClosureRow {
  group_id: string | null;
  date_from: string;
  date_to: string;
  reason: string | null;
}

const CLOSURE_SELECT = `
  select group_id, to_char(date_from, 'YYYY-MM-DD') as date_from, to_char(date_to, 'YYYY-MM-DD') as date_to, reason
    from public.closures`;

function closureLine(c: ClosureRow, names: Names): string {
  const when = c.date_from === c.date_to ? dayWithWeekday(c.date_from) : `${dayWithWeekday(c.date_from)} – ${dayWithWeekday(c.date_to)}`;
  return `- Dzień wolny: ${when}${c.reason ? `; powód: ${c.reason}` : ""}; ${groupOf(names, c.group_id)}`;
}

function section(title: string, lines: string[]): string {
  return `## ${title}\n${lines.length ? lines.join("\n") : "(brak)"}`;
}

// --- messages ---------------------------------------------------------------

interface MessageRow {
  id: string;
  group_id: string;
  author: string;
  sent_local: string;
  text: string;
  has_attachment: boolean;
  status: string;
}

const MESSAGE_SELECT = `
  select m.id, m.group_id, m.author, m.sent_at, to_char(m.sent_at at time zone '${TZ}', 'YYYY-MM-DD HH24:MI') as sent_local,
         m.text, m.has_attachment, m.status
    from public.messages m`;

function messageLine(m: MessageRow, names: Names, sources?: Set<string>): string {
  const flags = [
    m.has_attachment ? "[załącznik]" : "",
    m.status === "deleted_suspected" ? "[prawdopodobnie usunięta z grupy]" : "",
    sources?.has(m.id) ? "[wiadomość źródłowa]" : "",
  ].filter(Boolean);
  const group = sources ? ` (${names.groups.get(m.group_id) ?? "?"})` : "";
  return `[${m.sent_local}]${group} ${m.author}: ${m.text}${flags.length ? ` ${flags.join(" ")}` : ""}`;
}

/** Messages of the source's group around the first source message (before and after). */
async function messagesAround(db: Db, sourceIds: string[], around: number): Promise<MessageRow[]> {
  if (sourceIds.length === 0) return [];
  const { rows } = await db.query<MessageRow>(
    `with target as (select group_id, sent_at, id from public.messages where id = $1),
          before as (
            select m.* from public.messages m, target t
             where m.group_id = t.group_id and (m.sent_at, m.id) < (t.sent_at, t.id)
             order by m.sent_at desc, m.id desc limit $2),
          after as (
            select m.* from public.messages m, target t
             where m.group_id = t.group_id and (m.sent_at, m.id) >= (t.sent_at, t.id)
             order by m.sent_at, m.id limit $2 + 1),
          picked as (select * from before union all select * from after)
     ${MESSAGE_SELECT.replace("from public.messages m", "from picked m")}
      order by m.sent_at, m.id`,
    [sourceIds[0], around],
  );
  return rows;
}

function messagesSection(title: string, rows: MessageRow[], names: Names, sources?: Set<string>): string {
  return `## ${title}\n<wiadomosci>\n${rows.length ? rows.map((m) => messageLine(m, names, sources)).join("\n") : "(brak)"}\n</wiadomosci>`;
}

// --- views ------------------------------------------------------------------

export interface ViewContext {
  /** Short Polish description of the screen, e.g. "Kalendarz: październik 2026". */
  title: string;
  /** Data of the screen as plain text; message text inside <wiadomosci> is untrusted. */
  data: string;
}

async function upcoming(db: Db, names: Names, from: string, to: string): Promise<string[]> {
  const [events, bring, payments, actions, closures] = await Promise.all([
    db.query<EventRow>(
      `${EVENT_SELECT} where status = 'active' and (starts_at at time zone '${TZ}')::date between $1 and $2 order by starts_at`,
      [from, to],
    ),
    db.query<BringRow>(`${BRING_SELECT} where b.status = 'active' and b.due_date between $1 and $2 order by b.due_date, b.description`, [from, to]),
    db.query<PaymentRow>(`${PAYMENT_SELECT} where status = 'active' and paid_at is null order by due_date nulls last, description`),
    db.query<ActionRow>(`${ACTION_SELECT} where status = 'active' and resolved_at is null order by due_date nulls last`),
    db.query<ClosureRow>(`${CLOSURE_SELECT} where status = 'active' and date_to >= $1 and date_from <= $2 order by date_from`, [from, to]),
  ]);
  return [
    section(`Wydarzenia (${from} – ${to})`, events.rows.map((e) => eventLine(e, names))),
    section(`Do przyniesienia (${from} – ${to})`, bring.rows.map((b) => bringLine(b, names))),
    section("Niezapłacone płatności", payments.rows.map((p) => paymentLine(p, names))),
    section("Sprawy wymagające odpowiedzi", actions.rows.map((a) => actionLine(a, names))),
    section(`Dni wolne (${from} – ${to})`, closures.rows.map((c) => closureLine(c, names))),
  ];
}

const MONTHS = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];

/**
 * Loads what the family sees on a screen, with the server connection. Mirrors the PWA:
 * only active items (no needs_review or cancelled), group history only for tracked groups.
 */
export async function loadViewContext(db: Db, view: AssistantView, now: Date): Promise<ViewContext> {
  return viewContext(db, view, now, await loadNames(db));
}

/**
 * The assistant's system prompt (llm-prompts): the admin's template or the default, filled
 * with the kindergarten description, the children, the family and the asking member's name.
 */
export async function loadAssistantSystem(db: Db, userId: string): Promise<string> {
  const [names, profile, prompt] = await Promise.all([
    loadNames(db),
    db.query<{ content: string }>("select content from public.kindergarten_profile"),
    db.query<{ template: string }>("select template from public.llm_prompts where key = 'assistant'"),
  ]);
  return buildSystemPrompt("assistant", prompt.rows[0]?.template ?? null, {
    // Written by the family admin (kindergarten-profile); cannot close its block.
    przedszkole: (profile.rows[0]?.content ?? "").replaceAll("</przedszkole>", "<\\/przedszkole>"),
    dzieci: names.children
      .map(
        (c) =>
          `- ${c.name}${c.aliases.length ? ` (też: ${c.aliases.join(", ")})` : ""}${c.group_id ? ` (grupa ${names.groups.get(c.group_id) ?? "?"})` : ""}`,
      )
      .join("\n"),
    rodzina: [...new Set(names.people.values())].sort((a, b) => a.localeCompare(b, "pl")).join(", "),
    uzytkownik: names.people.get(userId) ?? "członek rodziny",
  });
}

async function viewContext(db: Db, view: AssistantView, now: Date, names: Names): Promise<ViewContext> {
  const today = warsawDate(now);

  switch (view.kind) {
    case "general": {
      const to = addDays(today, 30);
      return { title: "Ogólne pytanie (najbliższe 30 dni)", data: (await upcoming(db, names, today, to)).join("\n\n") };
    }

    case "today": {
      // The screen lists things to bring and events for the next 7 days (today-view).
      const parts = await upcoming(db, names, today, addDays(today, 7));
      const closures = await db.query<ClosureRow>(
        `${CLOSURE_SELECT} where status = 'active' and date_to >= $1 and date_from <= $2 order by date_from`,
        [today, addDays(today, 14)],
      );
      parts[4] = section("Dni wolne w ciągu 14 dni", closures.rows.map((c) => closureLine(c, names)));
      return { title: "Ekran „Dziś i jutro”", data: parts.join("\n\n") };
    }

    case "calendar": {
      const from = `${view.month}-01`;
      const [y, m] = view.month.split("-").map(Number) as [number, number];
      const to = addDays(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`, -1);
      const [events, closures, bring] = await Promise.all([
        db.query<EventRow>(
          `${EVENT_SELECT} where status = 'active'
             and (starts_at at time zone '${TZ}')::date <= $2
             and (coalesce(ends_at, starts_at) at time zone '${TZ}')::date >= $1
           order by starts_at`,
          [from, to],
        ),
        db.query<ClosureRow>(`${CLOSURE_SELECT} where status = 'active' and date_to >= $1 and date_from <= $2 order by date_from`, [from, to]),
        db.query<BringRow>(`${BRING_SELECT} where b.status = 'active' and b.due_date between $1 and $2 order by b.due_date`, [from, to]),
      ]);
      return {
        title: `Kalendarz: ${MONTHS[m - 1]} ${y}`,
        data: [
          section("Wydarzenia w miesiącu", events.rows.map((e) => eventLine(e, names))),
          section("Dni wolne w miesiącu", closures.rows.map((c) => closureLine(c, names))),
          section("Do przyniesienia w miesiącu", bring.rows.map((b) => bringLine(b, names))),
        ].join("\n\n"),
      };
    }

    case "event": {
      const { rows } = await db.query<EventRow & { source_message_ids: string[] }>(
        `${EVENT_SELECT.replace("select id,", "select id, source_message_ids,")} where id = $1 and status = 'active'`,
        [view.id],
      );
      const event = rows[0];
      if (!event) return { title: "Wydarzenie", data: "Nie znaleziono wydarzenia (mogło zostać odwołane)." };
      const [bring, messages] = await Promise.all([
        db.query<BringRow>(`${BRING_SELECT} where b.status = 'active' and b.event_id = $1 order by b.description`, [view.id]),
        messagesAround(db, event.source_message_ids, EVENT_CONTEXT),
      ]);
      return {
        title: `Wydarzenie: ${event.title}`,
        data: [
          section("Wydarzenie", [eventLine(event, names)]),
          section("Do przyniesienia na to wydarzenie", bring.rows.map((b) => bringLine(b, names))),
          messagesSection("Wiadomości, z których pochodzi wydarzenie (z kontekstem)", messages, names, new Set(event.source_message_ids)),
        ].join("\n\n"),
      };
    }

    case "list": {
      switch (view.list) {
        case "bring": {
          const { rows } = await db.query<BringRow>(
            `${BRING_SELECT} where b.status = 'active' and (b.due_date is null or b.due_date >= $1) order by b.due_date nulls last, b.description`,
            [today],
          );
          return { title: "Lista „Do przyniesienia”", data: section("Do przyniesienia (od dziś)", rows.map((b) => bringLine(b, names))) };
        }
        case "payments": {
          const { rows } = await db.query<PaymentRow>(
            `${PAYMENT_SELECT} where status = 'active' and (paid_at is null or paid_at >= $1::date - 60)
             order by paid_at is not null, due_date nulls last`,
            [today],
          );
          return { title: "Lista „Płatności”", data: section("Płatności (otwarte i zapłacone w ostatnich 60 dniach)", rows.map((p) => paymentLine(p, names))) };
        }
        case "actions": {
          const { rows } = await db.query<ActionRow>(
            `${ACTION_SELECT} where status = 'active' and (resolved_at is null or resolved_at >= $1::date - 60)
             order by resolved_at is not null, due_date nulls last`,
            [today],
          );
          return { title: "Lista „Wymaga odpowiedzi”", data: section("Sprawy (otwarte i załatwione w ostatnich 60 dniach)", rows.map((a) => actionLine(a, names))) };
        }
        case "closures": {
          const { rows } = await db.query<ClosureRow>(
            `${CLOSURE_SELECT} where status = 'active' and date_to >= $1::date - 30 order by date_from`,
            [today],
          );
          return { title: "Lista „Dni wolne”", data: section("Dni wolne (od 30 dni wstecz)", rows.map((c) => closureLine(c, names))) };
        }
      }
      break;
    }

    case "group": {
      const { rows: groups } = await db.query<{ name: string }>(
        "select coalesce(display_name, wa_name) as name from public.wa_groups where id = $1 and tracked",
        [view.id],
      );
      const group = groups[0];
      if (!group) return { title: "Historia grupy", data: "Nie znaleziono śledzonej grupy." };
      const { rows } = await db.query<MessageRow>(
        `select * from (${MESSAGE_SELECT} where m.group_id = $1 order by m.sent_at desc, m.id desc limit $2) newest
          order by sent_at, id`,
        [view.id, GROUP_HISTORY_MESSAGES],
      );
      return {
        title: `Historia grupy „${group.name}”`,
        data: messagesSection(`${rows.length} najnowszych wiadomości grupy „${group.name}”, od najstarszej`, rows, names),
      };
    }

    case "source": {
      const table = ITEM_TABLES[view.item_kind];
      const { rows } = await db.query<Record<string, unknown> & { source_message_ids: string[]; rationale: string | null }>(
        `select * from public.${table} where id = $1 and status = 'active'`,
        [view.id],
      );
      const item = rows[0];
      if (!item) return { title: "Skąd to wiem", data: "Nie znaleziono elementu (mógł zostać odwołany albo czeka na sprawdzenie)." };
      const describe: Record<string, string> = {
        event: `Wydarzenie: ${item.title}`,
        bring_item: `Do przyniesienia: ${item.description}`,
        payment: `Płatność: ${item.description}`,
        action_required: `Wymaga odpowiedzi: ${item.question}`,
        closure: `Dzień wolny: ${String(item.reason ?? "")}`,
        fact: `Ściągawka: ${item.label}: ${item.value}`,
      };
      const messages = await messagesAround(db, item.source_message_ids, SOURCE_CONTEXT);
      return {
        title: `Skąd to wiem – ${describe[view.item_kind]}`,
        data: [
          section("Element", [`- ${describe[view.item_kind]}`, `- Uzasadnienie ekstrakcji: ${item.rationale ?? "(brak)"}`]),
          messagesSection("Rozmowa wokół wiadomości źródłowej", messages, names, new Set(item.source_message_ids)),
        ].join("\n\n"),
      };
    }
  }
  throw new Error("unknown view");
}
