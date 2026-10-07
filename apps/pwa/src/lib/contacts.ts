import { normalizeAuthor, type ContactRole, type ContactRoleRow } from "@czyzyk/shared/contacts";
import type { Db } from "./supabase";

export interface StoredContactRole extends ContactRoleRow {
  profile_id: string | null;
}

export async function fetchContactRoles(db: Db): Promise<StoredContactRole[]> {
  const { data, error } = await db.from("contact_roles").select("author_key, role, label, profile_id");
  if (error) throw new Error(error.message);
  return (data ?? []) as StoredContactRole[];
}

export interface Author {
  key: string;
  /** How the author appears in messages (the most active spelling). */
  name: string;
  messages: number;
  lastAt: string;
}

/** Authors of tracked groups, spellings of one number or name merged, most recent first. */
export async function fetchAuthors(db: Db): Promise<Author[]> {
  const { data, error } = await db.rpc("list_message_authors");
  if (error) throw new Error(error.message);
  const byKey = new Map<string, Author & { top: number }>();
  for (const row of (data ?? []) as { author: string; messages: number; last_at: string }[]) {
    const key = normalizeAuthor(row.author);
    const messages = Number(row.messages);
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, { key, name: row.author, messages, lastAt: row.last_at, top: messages });
      continue;
    }
    seen.messages += messages;
    if (row.last_at > seen.lastAt) seen.lastAt = row.last_at;
    if (messages > seen.top) Object.assign(seen, { name: row.author, top: messages });
  }
  return [...byKey.values()].map(({ top: _top, ...a }) => a).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export async function saveContactRole(db: Db, key: string, role: ContactRole | null, label: string): Promise<void> {
  const { error } = await db.rpc("admin_save_contact_role", { p_key: key, p_role: role, p_label: label.trim() || null });
  if (error) throw new Error(error.message);
}

/** Marks (or clears, with null) the signed-in member's own WhatsApp number. */
export async function setMyPhone(db: Db, key: string | null): Promise<void> {
  const { error } = await db.rpc("set_my_phone", { p_key: key });
  if (error) throw new Error(error.message);
}
