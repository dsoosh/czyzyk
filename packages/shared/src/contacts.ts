/**
 * Roles of message authors (contact-roles): a teacher ("ciocia"), the management, another
 * parent or our own family. Authors are WhatsApp names or phone numbers as they appear in
 * notifications and exports; the key ties their spellings together. Browser-safe.
 */

export const CONTACT_ROLES = ["ciocia", "dyrekcja", "rodzic", "rodzina"] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  ciocia: "ciocia",
  dyrekcja: "dyrekcja",
  rodzic: "rodzic",
  rodzina: "nasza rodzina",
};

export interface ContactRoleRow {
  author_key: string;
  role: ContactRole;
  label: string | null;
}

const FORMAT_CHARS = /[­؜᠎​-‏‪-‮⁠-⁩﻿]/gu;
const PHONE_LIKE = /^[+\d\s().-]+$/;

/**
 * "+48 535 111 213", "0048535111213" and "535 111 213" → "+48535111213" (9 digits are taken
 * as a Polish number); a name → lowercased, single-spaced, without WhatsApp's "~ " prefix.
 */
export function normalizeAuthor(author: string): string {
  const s = author.normalize("NFC").replace(FORMAT_CHARS, "").replace(/^[\s~]+/u, "").trim();
  const digits = s.replace(/\D/g, "");
  if (PHONE_LIKE.test(s) && digits.length >= 9) {
    const full = digits.startsWith("00") ? digits.slice(2) : digits.length === 9 ? `48${digits}` : digits;
    return `+${full}`;
  }
  return s.replace(/\s+/gu, " ").toLocaleLowerCase("pl-PL");
}

/** A typed phone number as a key, or null when it does not look like one. */
export function phoneKey(input: string): string | null {
  const key = normalizeAuthor(input);
  return /^\+\d{10,15}$/.test(key) ? key : null;
}

/** Role of an author, if mapped. */
export function roleOf(roles: readonly ContactRoleRow[], author: string): ContactRoleRow | null {
  const key = normalizeAuthor(author);
  return roles.find((r) => r.author_key === key) ?? null;
}

/**
 * Whether the text mentions our family: "@48535111213" / "@+48 535 111 213" for a family
 * number, or "@Name" for a family author name or label.
 */
export function mentionsFamily(roles: readonly ContactRoleRow[], text: string): boolean {
  const family = roles.filter((r) => r.role === "rodzina");
  if (family.length === 0 || !text.includes("@")) return false;
  const phones = new Set(family.filter((r) => r.author_key.startsWith("+")).map((r) => r.author_key));
  for (const m of text.matchAll(/@\+?(\d[\d ]{7,}\d)/g)) {
    if (phones.has(normalizeAuthor(m[1]!))) return true;
  }
  const lower = text.normalize("NFC").toLocaleLowerCase("pl-PL");
  const names = family.flatMap((r) => [r.author_key.startsWith("+") ? null : r.author_key, r.label?.trim().toLocaleLowerCase("pl-PL")]);
  return names.some((n) => n && n.length >= 2 && lower.includes(`@${n}`));
}
