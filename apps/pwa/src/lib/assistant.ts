import type { AssistantAnswer, AssistantTurn, AssistantView } from "@czyzyk/shared/assistant";
import { monthTitle } from "./dates";
import type { Db } from "./supabase";

const LISTS: Record<string, Extract<AssistantView, { kind: "list" }>["list"]> = {
  "": "bring",
  platnosci: "payments",
  sprawy: "actions",
  "dni-wolne": "closures",
};
const LIST_TITLES = { bring: "Do przyniesienia", payments: "Płatności", actions: "Wymaga odpowiedzi", closures: "Dni wolne" };
const ITEM_KINDS = ["event", "bring_item", "payment", "action_required", "closure", "fact"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * What the assistant should look at for the current route, or null where the
 * assistant is not offered (settings, admin). Only identifiers: the API loads the data.
 */
export function viewForLocation(pathname: string, search: string): AssistantView | null {
  const parts = pathname.split("/").filter(Boolean);
  const [first = "", second = "", third = ""] = parts;
  switch (first) {
    case "":
      return { kind: "today" };
    case "kalendarz": {
      if (second === "wydarzenie" && UUID.test(third)) return { kind: "event", id: third };
      const month = new URLSearchParams(search).get("miesiac") ?? "";
      return MONTH.test(month) ? { kind: "calendar", month } : { kind: "general" };
    }
    case "listy": {
      const list = LISTS[second];
      return list ? { kind: "list", list } : { kind: "general" };
    }
    case "czaty":
      return UUID.test(second) ? { kind: "group", id: second } : { kind: "general" };
    case "zrodlo":
      return (ITEM_KINDS as readonly string[]).includes(second) && UUID.test(third)
        ? { kind: "source", item_kind: second as (typeof ITEM_KINDS)[number], id: third }
        : { kind: "general" };
    default:
      return null;
  }
}

/** Short label of the view for the panel header. */
export function viewLabel(view: AssistantView): string {
  switch (view.kind) {
    case "general":
      return "najbliższe tygodnie";
    case "today":
      return "dziś i jutro";
    case "calendar":
      return `kalendarz – ${monthTitle(view.month)}`;
    case "event":
      return "to wydarzenie";
    case "list":
      return `lista „${LIST_TITLES[view.list]}”`;
    case "group":
      return "historia tej grupy";
    case "source":
      return "ten element i jego źródło";
  }
}

export class AssistantError extends Error {
  constructor(public readonly reason: "daily_limit" | "rate_limited" | "not_configured" | "failed") {
    super(reason);
  }
}

export const ASSISTANT_ERRORS: Record<AssistantError["reason"], string> = {
  daily_limit: "Wyczerpano dzienny limit pytań – odnowi się jutro.",
  rate_limited: "Za dużo pytań naraz. Spróbuj za chwilę.",
  not_configured: "Asystent nie jest jeszcze skonfigurowany na serwerze.",
  failed: "Nie udało się uzyskać odpowiedzi. Spróbuj ponownie.",
};

export async function askAssistant(
  db: Db,
  apiUrl: string,
  body: { view: AssistantView; question: string; history: AssistantTurn[] },
): Promise<string> {
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AssistantError("failed");
  let res: Response;
  try {
    res = await fetch(`${apiUrl.replace(/\/+$/, "")}/assistant/ask`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AssistantError("failed");
  }
  if (res.status === 429) {
    const error = ((await res.json().catch(() => ({}))) as { error?: string }).error;
    throw new AssistantError(error === "daily_limit" ? "daily_limit" : "rate_limited");
  }
  if (res.status === 503) throw new AssistantError("not_configured");
  if (!res.ok) throw new AssistantError("failed");
  return ((await res.json()) as AssistantAnswer).answer;
}
