import {
  buildSystemPrompt,
  CONTACT_ROLE_LABELS,
  EXTRACTION_TOOL_NAME,
  mentionsFamily,
  roleOf,
  type ContactRoleRow,
  type ItemType,
} from "@czyzyk/shared";

export { EXTRACTION_TOOL_NAME };
import type { BatchMessage, ExistingItem, ExtractionBatch } from "./batch.js";
import { warsawDayLong, warsawStamp } from "./time.js";


export interface Aliases {
  /** W1… → message id */
  messages: Map<string, string>;
  /** R1… → family id (families) */
  families: Map<string, string>;
  /** E1… → existing item; `foreign` for an item of another group (only join). */
  items: Map<string, { id: string; type: ItemType; foreign?: boolean }>;
}

/** A document image shown to the model after the text, labelled with its message alias. */
export interface PromptImage {
  label: string;
  /** JPEG, base64. */
  data: string;
}

export interface ExtractionPrompt {
  system: string;
  user: string;
  images?: PromptImage[];
  aliases: Aliases;
  /** Ids of the messages this prompt processes (marked processed on success). */
  newMessageIds: string[];
}

const TYPE_LABELS: Record<ItemType, string> = {
  event: "wydarzenie",
  bring_item: "rzecz do przyniesienia",
  payment: "płatność",
  action_required: "wymaga odpowiedzi",
  closure: "dzień wolny",
  fact: "fakt",
};

/** Older templates may still use these; children and families now come in the request (families). */
const IN_REQUEST = "(zob. blok <rodziny> w treści zapytania)";

/**
 * System prompt: the operator's template (or the default) with the kindergarten description,
 * then the fixed security, family and answer rules (llm-prompts). Without any family data, so
 * it is the same for every group and family and stays cacheable (families). Group messages,
 * which are untrusted, and the families go into the user turn.
 */
export function extractionSystemPrompt(batch: Pick<ExtractionBatch, "kindergarten" | "promptTemplate">): string {
  return buildSystemPrompt("extraction", batch.promptTemplate, {
    przedszkole: escapeTags(batch.kindergarten.trim()),
    dzieci: IN_REQUEST,
    rodzina: IN_REQUEST,
  });
}

/** Message text as a JSON string with angle brackets escaped, so it cannot close our tags. */
function quote(text: string): string {
  return escapeTags(JSON.stringify(text));
}

function escapeTags(json: string): string {
  return json.replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

/**
 * " [ciocia]", " [rodzina R1]", " [do R2]" – roles of authors (contact-roles) and, for members
 * of families using the app, their family's alias (families).
 */
function authorTags(m: BatchMessage, roles: readonly ContactRoleRow[], familyAlias: Map<string, string>): string {
  const role = roleOf(roles, m.author);
  const own = role?.role === "rodzina" ? familyAlias.get(role.family_id ?? "") : undefined;
  const tags = [
    role?.role === "rodzina" ? (own ? `[rodzina ${own}]` : `[${CONTACT_ROLE_LABELS.rodzic}]`) : role ? `[${CONTACT_ROLE_LABELS[role.role]}]` : null,
    ...[...familyAlias]
      .filter(([familyId, alias]) => alias !== own && mentionsFamily(roles, m.text, familyId))
      .map(([, alias]) => `[do ${alias}]`),
  ];
  return tags.filter(Boolean).map((t) => ` ${t}`).join("");
}

/** "R1: dzieci w tej grupie: "Zosia" (inne formy imienia: "Zofia")" */
function renderFamily(alias: string, family: ExtractionBatch["families"][number]): string {
  const children = family.children.map(
    (c) => `${quote(c.name)}${c.aliases.length ? ` (inne formy imienia: ${c.aliases.map(quote).join(", ")})` : ""}`,
  );
  return `${alias}: dzieci w tej grupie: ${children.length ? children.join(", ") : "(brak)"}`;
}

/** Longest document text put into the prompt (document-import). */
const MAX_DOCUMENT_TEXT = 4000;

function renderMessage(alias: string, m: BatchMessage, roles: readonly ContactRoleRow[], familyAlias: Map<string, string>): string {
  const attachment = m.hasAttachment ? " [załącznik]" : "";
  const documents = (m.documents ?? []).map((d) => {
    const text = d.text ? `: ${quote(d.text.slice(0, MAX_DOCUMENT_TEXT))}` : "";
    const image = d.hasImage ? " (obraz poniżej)" : "";
    return ` [dokument ${quote(d.fileName)}${image}${text}]`;
  });
  const pasted = m.manual ? " [wklejona ręcznie]" : "";
  return `${alias} | ${warsawStamp(m.sentAt)} | ${quote(m.author)}${authorTags(m, roles, familyAlias)}${pasted}: ${quote(m.text)}${attachment}${documents.join("")}`;
}

function renderItem(alias: string, item: ExistingItem, eventAliasById: Map<string, string>): string {
  const data = { ...item.data } as Record<string, unknown>;
  if (item.type === "bring_item" && typeof data.event === "string") {
    data.event = eventAliasById.get(data.event) ?? null;
  }
  const review = item.status === "needs_review" ? " (czeka na przegląd)" : "";
  const children = item.children.length ? ` | dzieci: ${escapeTags(JSON.stringify(item.children))}` : "";
  const group = item.groupName ? ` | grupa: ${quote(item.groupName)}` : "";
  return `${alias} | ${item.type} (${TYPE_LABELS[item.type]})${review} | ${escapeTags(JSON.stringify(data))}${children}${group}`;
}

export function buildExtractionPrompt(batch: ExtractionBatch, now: Date): ExtractionPrompt {
  const aliases: Aliases = { messages: new Map(), items: new Map(), families: new Map() };
  const familyAlias = new Map<string, string>();
  const familyLines = batch.families.map((f, i) => {
    const alias = `R${i + 1}`;
    aliases.families.set(alias, f.id);
    familyAlias.set(f.id, alias);
    return renderFamily(alias, f);
  });
  let w = 0;
  const messageAlias = (m: BatchMessage) => {
    const alias = `W${++w}`;
    aliases.messages.set(alias, m.id);
    return alias;
  };

  const eventAliasById = new Map<string, string>();
  const itemLines = batch.items.map((item, i) => {
    const alias = `E${i + 1}`;
    aliases.items.set(alias, { id: item.id, type: item.type });
    if (item.type === "event") eventAliasById.set(item.id, alias);
    return [alias, item] as const;
  });

  const otherLines = (batch.otherItems ?? []).map((item, i) => {
    const alias = `E${itemLines.length + i + 1}`;
    aliases.items.set(alias, { id: item.id, type: item.type, foreign: true });
    return renderItem(alias, item, eventAliasById);
  });

  const render = (m: BatchMessage) => renderMessage(messageAlias(m), m, batch.contactRoles, familyAlias);
  const contextLines = batch.contextMessages.map(render);
  const newLines = batch.newMessages.map(render);
  const laterLines = batch.laterMessages.map(render);

  const user = [
    `Dzisiaj: ${warsawDayLong(now)} (strefa Europe/Warsaw).`,
    "",
    `Grupa: ${quote(batch.group.name)}.`,
    "",
    // Families using the app with children in this group (families); not in the cached system prompt.
    ...(familyLines.length ? ["<rodziny>", ...familyLines, "</rodziny>", ""] : []),
    "<elementy>",
    ...(itemLines.length ? itemLines.map(([alias, item]) => renderItem(alias, item, eventAliasById)) : ["(brak)"]),
    "</elementy>",
    "",
    // Shared items (shared-items): only when another child of the family attends another group.
    ...(otherLines.length ? ["<elementy_innych_grup>", ...otherLines, "</elementy_innych_grup>", ""] : []),
    "<wiadomosci_wczesniejsze>",
    ...(contextLines.length ? contextLines : ["(brak)"]),
    "</wiadomosci_wczesniejsze>",
    "",
    "<wiadomosci_nowe>",
    ...newLines,
    "</wiadomosci_nowe>",
    "",
    // Only when an older message is analysed again: what was written after it.
    ...(laterLines.length ? ["<wiadomosci_pozniejsze>", ...laterLines, "</wiadomosci_pozniejsze>", ""] : []),
    `Przeanalizuj nowe wiadomości i wywołaj narzędzie ${EXTRACTION_TOOL_NAME}.`,
  ].join("\n");

  const aliasById = new Map([...aliases.messages].map(([alias, id]) => [id, alias]));
  const images = (batch.images ?? []).map((i) => ({
    label: `Obraz dokumentu ${quote(i.fileName)} z wiadomości ${aliasById.get(i.messageId) ?? "?"}:`,
    data: i.data,
  }));

  return {
    system: extractionSystemPrompt(batch),
    user,
    ...(images.length ? { images } : {}),
    aliases,
    newMessageIds: batch.newMessages.map((m) => m.id),
  };
}
