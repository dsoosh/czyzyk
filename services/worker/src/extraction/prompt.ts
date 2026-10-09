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

/**
 * System prompt: the admin's template (or the default) filled with trusted family data,
 * then the fixed security and answer rules (llm-prompts). Stable between messages of a
 * family, so it stays cacheable. Group messages, which are untrusted, go into the user turn.
 */
export function extractionSystemPrompt(batch: Pick<ExtractionBatch, "kindergarten" | "children" | "family" | "promptTemplate">): string {
  return buildSystemPrompt("extraction", batch.promptTemplate, {
    przedszkole: escapeTags(batch.kindergarten.trim()),
    dzieci: batch.children
      .map(
        (c) =>
          `${quote(c.name)}${c.aliases.length ? ` (inne formy imienia: ${c.aliases.map(quote).join(", ")})` : ""}${c.group ? ` – grupa ${quote(c.group)}` : ""}`,
      )
      .join("\n"),
    rodzina: batch.family.map(quote).join(", "),
  });
}

/** Message text as a JSON string with angle brackets escaped, so it cannot close our tags. */
function quote(text: string): string {
  return escapeTags(JSON.stringify(text));
}

function escapeTags(json: string): string {
  return json.replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

/** " [ciocia]", " [nasza rodzina] [do nas]" – roles the family gave authors (contact-roles). */
function authorTags(m: BatchMessage, roles: readonly ContactRoleRow[]): string {
  const role = roleOf(roles, m.author)?.role;
  const tags = [role ? `[${CONTACT_ROLE_LABELS[role]}]` : null, role !== "rodzina" && mentionsFamily(roles, m.text) ? "[do nas]" : null];
  return tags.filter(Boolean).map((t) => ` ${t}`).join("");
}

/** Longest document text put into the prompt (document-import). */
const MAX_DOCUMENT_TEXT = 4000;

function renderMessage(alias: string, m: BatchMessage, roles: readonly ContactRoleRow[]): string {
  const attachment = m.hasAttachment ? " [załącznik]" : "";
  const documents = (m.documents ?? []).map((d) => {
    const text = d.text ? `: ${quote(d.text.slice(0, MAX_DOCUMENT_TEXT))}` : "";
    const image = d.hasImage ? " (obraz poniżej)" : "";
    return ` [dokument ${quote(d.fileName)}${image}${text}]`;
  });
  const pasted = m.manual ? " [wklejona ręcznie]" : "";
  return `${alias} | ${warsawStamp(m.sentAt)} | ${quote(m.author)}${authorTags(m, roles)}${pasted}: ${quote(m.text)}${attachment}${documents.join("")}`;
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
  const aliases: Aliases = { messages: new Map(), items: new Map() };
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

  const contextLines = batch.contextMessages.map((m) => renderMessage(messageAlias(m), m, batch.contactRoles));
  const newLines = batch.newMessages.map((m) => renderMessage(messageAlias(m), m, batch.contactRoles));
  const laterLines = batch.laterMessages.map((m) => renderMessage(messageAlias(m), m, batch.contactRoles));

  const user = [
    `Dzisiaj: ${warsawDayLong(now)} (strefa Europe/Warsaw).`,
    "",
    `Grupa: ${quote(batch.group.name)}.`,
    "",
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
