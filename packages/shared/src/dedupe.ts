import { createHash } from "node:crypto";

/** NFC, lower case, whitespace collapsed to single spaces, trimmed. */
export function normalizeText(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase("pl-PL").replace(/\s+/gu, " ").trim();
}

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/** Start of the UTC minute containing `date`, as an ISO string. */
export function floorToMinute(date: Date): string {
  const d = new Date(date.getTime());
  d.setUTCSeconds(0, 0);
  return d.toISOString();
}

/**
 * Matching key shared by notification and export ingest:
 * group + author + sending minute + hash of the normalised text.
 */
export function dedupeKey(input: { groupId: string; author: string; sentAt: Date; text: string }): string {
  return sha256(
    [input.groupId, normalizeText(input.author), floorToMinute(input.sentAt), sha256(normalizeText(input.text))].join("|"),
  );
}
