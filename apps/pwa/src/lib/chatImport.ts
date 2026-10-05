import { unzipSync } from "fflate";
import type { Db } from "./supabase";

export interface ImportSummary {
  messages: number;
  inserted: number;
  duplicates: number;
  for_extraction: number;
  skipped_lines: number;
}

/** Thrown with a Polish message the import screen can show as is. */
export class ImportError extends Error {}

const isChatText = (name: string) => /\.txt$/i.test(name) && !name.includes("/") && !name.startsWith("__MACOSX");

/** Prefers `_chat.txt` (Android/iOS export), then "WhatsApp Chat…"/"Czat WhatsApp…", then any top-level .txt. */
function pickChatEntry(names: string[]): string | null {
  return (
    names.find((n) => n === "_chat.txt") ??
    names.find((n) => /^(WhatsApp Chat|Czat WhatsApp)/i.test(n)) ??
    names[0] ??
    null
  );
}

/** The filter keeps fflate from even decompressing photos, videos and other media. */
function unzipChatText(data: Uint8Array): Record<string, Uint8Array> {
  return unzipSync(data, { filter: (file) => isChatText(file.name) });
}

function readBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer().then((b) => new Uint8Array(b));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Text of the chat from a WhatsApp export: a .txt file as is, or only the chat text
 * file out of a .zip. Media in the archive are never read or sent anywhere.
 */
export async function readChatExport(file: File): Promise<string> {
  const bytes = await readBytes(file);
  const isZip = /\.zip$/i.test(file.name) || (bytes[0] === 0x50 && bytes[1] === 0x4b);
  if (!isZip) return new TextDecoder("utf-8").decode(bytes);

  let files: Record<string, Uint8Array>;
  try {
    files = unzipChatText(bytes);
  } catch {
    throw new ImportError("Nie udało się otworzyć pliku ZIP.");
  }
  const name = pickChatEntry(Object.keys(files));
  if (!name) throw new ImportError("W paczce nie ma pliku czatu (.txt).");
  return new TextDecoder("utf-8").decode(files[name]);
}

const API_ERRORS: Record<string, string> = {
  unauthorized: "Sesja wygasła – zaloguj się ponownie.",
  forbidden: "Import jest dostępny tylko dla administratora.",
  group_not_tracked: "Ta grupa nie jest śledzona. Włącz śledzenie w zakładce Grupy.",
  group_not_found: "Nie ma takiej grupy.",
  no_messages: "Nie rozpoznano żadnych wiadomości w pliku.",
  too_many_messages: "Plik ma za dużo wiadomości (limit 50 000).",
  import_not_configured: "Import nie jest skonfigurowany na serwerze (SUPABASE_URL).",
};

export async function importChat(
  db: Db,
  apiUrl: string,
  body: { group_id: string; text: string; extract_days: number },
): Promise<ImportSummary> {
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ImportError(API_ERRORS.unauthorized!);
  let res: Response;
  try {
    res = await fetch(`${apiUrl}/import/chat`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ImportError("Brak połączenia z serwerem.");
  }
  const json = (await res.json().catch(() => ({}))) as { error?: string } & Partial<ImportSummary>;
  if (!res.ok) {
    if (res.status === 413) throw new ImportError("Plik jest za duży.");
    throw new ImportError(API_ERRORS[json.error ?? ""] ?? `Import nie powiódł się (błąd ${res.status}).`);
  }
  return json as ImportSummary;
}
