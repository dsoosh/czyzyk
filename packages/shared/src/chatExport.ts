/**
 * Parser of WhatsApp "Export chat" text files (`_chat.txt`, `WhatsApp Chat with X.txt`).
 * Pure TypeScript without Node APIs: used by the PWA (preview) and services/api (import).
 *
 * Supported headers (Polish and English phones, Android and iOS, 24 h and 12 h clocks):
 *   07.10.2026, 18:02 - Pani Ania: text            Android, day first
 *   10/9/26, 8:15 PM - Anna: text                  Android, US (month first)
 *   [07.10.2026, 18:02:11] Pani Ania: text         iOS
 * A line without a header continues the previous message.
 */

export interface ParsedMessage {
  author: string;
  /** Local Europe/Warsaw time as written in the export, "YYYY-MM-DDTHH:mm:ss". */
  localTime: string;
  sentAt: Date;
  text: string;
  hasAttachment: boolean;
}

export interface ParseResult {
  messages: ParsedMessage[];
  /** Header lines skipped as system notices or deleted messages. */
  skipped: number;
}

const DATE_TIME =
  String.raw`(\d{1,2})[./-](\d{1,2})[./-](\d{2,4}),? (\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?(?: ?([AaPp])\.? ?[Mm]\.?)?`;
const ANDROID = new RegExp(`^${DATE_TIME} [-–] (.*)$`);
const IOS = new RegExp(`^\\[${DATE_TIME}\\] (.*)$`);

/** Invisible marks WhatsApp puts around system lines, attachments and in "8:15 PM". */
const LRM = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

const ATTACHMENT_PATTERNS = [
  /<(?:załączony(?: plik)?|attached):\s*[^>]*>/giu,
  /\S+\.[A-Za-z0-9]{2,5} \((?:plik załączony|file attached)\)/giu,
  /<(?:Pominięto multimedia|Multimedia pominięte|Media omitted)>/giu,
  /^(?:image|video|audio|sticker|GIF|document|Contact card) omitted$/imu,
  /^(?:obraz|zdjęcie|wideo|film|audio|naklejka|GIF|dokument|wizytówka)(?: został[ao]?)? pominięt[aeyo]$/imu,
  /^(?:Pominięto|Pominięte) (?:obraz|zdjęcie|wideo|film|audio|naklejkę|GIF|dokument)$/imu,
];

const EDITED = /\s*<(?:Ta wiadomość została zmieniona|Edytowano|This message was edited)>\s*$/iu;

const DELETED = [
  /^Ta wiadomość została usunięta\.?$/iu,
  /^Usunięto tę wiadomość\.?$/iu,
  /^Usunięto wiadomość\.?$/iu,
  /^This message was deleted\.?$/iu,
  /^You deleted this message\.?$/iu,
];

/** Notices WhatsApp writes as if a member sent them (iOS prefixes them with the group name). */
const SYSTEM_TEXT = [
  /szyfrowan/iu,
  /end-to-end encrypted/iu,
  /\b(?:dodał[ao]?|usunął|usunęła|opuścił[ao]?|dołączył[ao]?|utworzył[ao]?|zmienił[ao]?)\b/iu,
  /\b(?:added|removed|left|joined|created group|changed (?:the|this) group|changed the subject|changed their phone number)\b/iu,
];

function warsawOffsetMs(utcMs: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Warsaw",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  return asUtc - (utcMs - (utcMs % 1000));
}

/** UTC instant of a wall-clock time in Europe/Warsaw (DST aware). */
export function warsawToUtc(y: number, m: number, d: number, hh: number, mm: number, ss = 0): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss);
  const first = guess - warsawOffsetMs(guess);
  return new Date(guess - warsawOffsetMs(first));
}

interface Header {
  a: number;
  b: number;
  year: number;
  hour: number;
  minute: number;
  second: number;
  ampm: "a" | "p" | null;
  slash: boolean;
  rest: string;
}

function matchHeader(line: string): Header | null {
  const m = ANDROID.exec(line) ?? IOS.exec(line);
  if (!m) return null;
  const year = Number(m[3]);
  return {
    a: Number(m[1]),
    b: Number(m[2]),
    year: year < 100 ? 2000 + year : year,
    hour: Number(m[4]),
    minute: Number(m[5]),
    second: m[6] ? Number(m[6]) : 0,
    ampm: m[7] ? (m[7].toLowerCase() as "a" | "p") : null,
    slash: line.slice(0, 12).includes("/"),
    rest: m[8]!,
  };
}

/** Day first unless the file proves otherwise; US-style "M/d/yy, h:mm PM" is month first. */
function detectDayFirst(headers: Header[]): boolean {
  if (headers.some((h) => h.a > 12)) return true;
  if (headers.some((h) => h.b > 12)) return false;
  return !headers.some((h) => h.slash && h.ampm);
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

function cleanText(raw: string): { text: string; hasAttachment: boolean } {
  let text = raw.replace(EDITED, "");
  let hasAttachment = false;
  for (const pattern of ATTACHMENT_PATTERNS) {
    text = text.replace(pattern, () => {
      hasAttachment = true;
      return "";
    });
  }
  return { text: text.replace(/[ \t]+\n/g, "\n").replace(/^\s+|\s+$/g, ""), hasAttachment };
}

export function parseChatExport(content: string): ParseResult {
  const lines = content.replace(/^\uFEFF/, "").replace(/[\u202f\u00a0]/g, " ").split(/\r?\n/);
  // Only leading marks are removed here: iOS also marks the message body, which tells system lines apart.
  const headers = lines.map((l) => matchHeader(l.replace(/^[\u200e\u200f]+/, "")));
  const dayFirst = detectDayFirst(headers.filter((h): h is Header => h !== null));

  const messages: ParsedMessage[] = [];
  let skipped = 0;
  let current: { author: string; localTime: string; sentAt: Date; lines: string[]; system: boolean } | null = null;

  const flush = () => {
    if (!current) return;
    const raw = current.lines.join("\n");
    if (current.system || DELETED.some((p) => p.test(raw.replace(LRM, "").trim()))) {
      skipped++;
    } else {
      const { text, hasAttachment } = cleanText(raw.replace(LRM, ""));
      if (text || hasAttachment) {
        messages.push({ author: current.author, localTime: current.localTime, sentAt: current.sentAt, text, hasAttachment });
      } else skipped++;
    }
    current = null;
  };

  lines.forEach((line, i) => {
    const h = headers[i];
    if (!h) {
      if (current) current.lines.push(line);
      return;
    }
    flush();
    const day = dayFirst ? h.a : h.b;
    const month = dayFirst ? h.b : h.a;
    let hour = h.hour;
    if (h.ampm === "p" && hour < 12) hour += 12;
    if (h.ampm === "a" && hour === 12) hour = 0;
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || h.minute > 59) {
      skipped++;
      return;
    }
    const localTime = `${h.year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(h.minute)}:${pad(h.second)}`;
    const sentAt = warsawToUtc(h.year, month, day, hour, h.minute, h.second);

    // iOS marks system lines and attachments with a left-to-right mark after the author.
    const rest = h.rest;
    const sep = rest.indexOf(": ");
    if (sep <= 0) {
      current = { author: "", localTime, sentAt, lines: [], system: true };
      return;
    }
    const author = rest.slice(0, sep).replace(LRM, "").trim();
    const body = rest.slice(sep + 2);
    const marked = body.startsWith("\u200e");
    const plain = body.replace(LRM, "");
    const isAttachment = ATTACHMENT_PATTERNS.some((p) => {
      p.lastIndex = 0;
      const hit = p.test(plain);
      p.lastIndex = 0;
      return hit;
    });
    const system = marked && !isAttachment && SYSTEM_TEXT.some((p) => p.test(plain));
    current = { author, localTime, sentAt, lines: [body], system };
  });
  flush();
  return { messages, skipped };
}

const FILE_NAME_PATTERNS = [
  /^WhatsApp Chat with (.+)$/i,
  /^WhatsApp Chat - (.+)$/i,
  /^Czat WhatsApp z (.+)$/i,
  /^Czat WhatsApp [-–] (.+)$/i,
  /^Czat (?:w|z) (.+)$/i,
];

/** Chat name from an export file name ("WhatsApp Chat with Motylki 2026_27.zip" → "Motylki 2026_27"). */
export function chatNameFromFileName(fileName: string): string | null {
  const base = fileName.replace(/^.*[\\/]/, "").replace(/\.(zip|txt)$/i, "").replace(/ \(\d+\)$/, "").trim();
  for (const pattern of FILE_NAME_PATTERNS) {
    const m = pattern.exec(base);
    if (m) return m[1]!.trim();
  }
  return null;
}

const simplify = (s: string) =>
  s
    .normalize("NFC")
    .toLocaleLowerCase("pl-PL")
    .replace(/[\\/_]+/g, "/")
    .replace(/\s+/g, " ")
    .trim();

/** Best matching group for an export file name, by WhatsApp name or display name. */
export function matchGroupByFileName<T extends { wa_name: string; display_name: string | null }>(
  fileName: string,
  groups: T[],
): T | null {
  const name = chatNameFromFileName(fileName);
  if (!name) return null;
  const wanted = simplify(name);
  return (
    groups.find((g) => simplify(g.wa_name) === wanted) ??
    groups.find((g) => g.display_name != null && simplify(g.display_name) === wanted) ??
    null
  );
}
