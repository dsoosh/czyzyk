/** Links in message text (message-links): found, named briefly, opened outside the app. */

export type TextPart = { text: string } | { url: string; label: string };

// http(s) links and bare www. addresses; anything else stays plain text.
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"]+/giu;
/** Punctuation that ends a sentence rather than the link. */
const TRAILING = /[.,;:!?…)\]}'"»]+$/u;

const KNOWN: [RegExp, string][] = [
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "YouTube"],
  [/^forms\.gle$/, "Formularz Google"],
  [/^docs\.google\.com$/, "Dokument Google"],
  [/^drive\.google\.com$/, "Dysk Google"],
  [/^maps\.app\.goo\.gl$|^(www\.)?google\.[a-z.]+$/, "Google"],
  [/(^|\.)facebook\.com$|^fb\.me$|^fb\.watch$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)spotify\.com$/, "Spotify"],
];

/** "Formularz Google", "YouTube", "wroclaw.pl/…" – a short name instead of the long address. */
export function linkLabel(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  if (host === "docs.google.com" && u.pathname.startsWith("/forms")) return "Formularz Google";
  if (host === "google.com" && u.pathname.startsWith("/maps")) return "Mapa Google";
  if (host === "maps.app.goo.gl") return "Mapa Google";
  const known = KNOWN.find(([re]) => re.test(host));
  if (known) return known[1];
  return u.pathname.length > 1 || u.search ? `${host}/…` : host;
}

/** Text split into plain parts and links (only http and https are ever linked). */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const raw = match[0].replace(TRAILING, "");
    const start = match.index!;
    const url = raw.startsWith("www.") ? `https://${raw}` : raw;
    if (!/^https?:\/\//i.test(url)) continue;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ url, label: linkLabel(url) });
    last = start + raw.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
