import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderAt } from "../../test/render";

const calls = [
  {
    id: "t0",
    kind: "triage",
    group_id: "g1",
    model: "tani",
    request: { system: "Wstępnie oceniasz", user: "Dziękuję!" },
    response: { relevant: false },
    error: null,
    usage: { input_tokens: 300, output_tokens: 20 },
    duration_ms: 500,
    created_at: "2026-10-07T16:07:00Z",
  },
  {
    id: "c0",
    kind: "document",
    group_id: "g1",
    model: "m",
    request: { system: "Oceniasz zdjęcie", user: "", images: ["Zdjęcie dokumentu"] },
    response: { containsPeople: true, description: "Plakat." },
    error: null,
    usage: null,
    duration_ms: 1000,
    created_at: "2026-10-07T16:06:00Z",
  },
  {
    id: "c1",
    kind: "extraction",
    group_id: "g1",
    model: "model-z-konfiguracji",
    request: { system: "Jesteś asystentem rodziców", user: "W1 | 07.10 | \"Pani Ania\": \"W piątek bal\"" },
    response: { operations: [{ op: "create", type: "event" }] },
    error: null,
    usage: { input_tokens: 1200, output_tokens: 80 },
    duration_ms: 2400,
    created_at: "2026-10-07T16:05:00Z",
  },
  {
    id: "c2",
    kind: "extraction",
    group_id: "g1",
    model: null,
    request: { system: "s", user: "u" },
    response: null,
    error: "ExtractionError: no_tool_call",
    usage: null,
    duration_ms: 900,
    created_at: "2026-10-07T15:00:00Z",
  },
];

describe("Admin → LLM", () => {
  it("pokazuje wywołania od najnowszych z zapytaniem, odpowiedzią i błędem", async () => {
    renderAt("/admin/llm", { admin: true, tables: { llm_calls: calls, wa_groups: [{ id: "g1", wa_name: "Motylki 2026/27", display_name: "Motylki" }] } });
    const listed = await screen.findAllByRole("listitem");
    expect(listed).toHaveLength(4);
    expect(within(listed[0]!).getByText("wstępna ocena")).toBeInTheDocument();
    expect(within(listed[0]!).getByText("pominięte")).toBeInTheDocument();
    const all = listed.slice(1);
    expect(within(all[0]!).getByText("kontrola zdjęcia")).toBeInTheDocument();
    expect(within(all[0]!).getByText("widać ludzi – obraz usunięty")).toBeInTheDocument();
    const items = all.slice(1);
    expect(within(items[0]!).getByText("1 operacja")).toBeInTheDocument();
    expect(within(items[0]!).getByText(/1200 → 80 tokenów · 2.4 s/)).toBeInTheDocument();
    expect(within(items[0]!).getByText("Motylki")).toBeInTheDocument();
    await userEvent.click(within(items[0]!).getByText("1 operacja"));
    expect(within(items[0]!).getByText(/W piątek bal/)).toBeInTheDocument();
    expect(within(items[0]!).getByText(/"type": "event"/)).toBeInTheDocument();
    expect(within(items[1]!).getByText("błąd")).toBeInTheDocument();
    expect(within(items[1]!).getByText("Błąd: ExtractionError: no_tool_call")).toBeInTheDocument();
  });

  it("?wywolanie= pokazuje jedno, otwarte wywołanie (link z wiadomości w czacie)", async () => {
    renderAt("/admin/llm?wywolanie=c2", { admin: true, tables: { llm_calls: calls, wa_groups: [] } });
    expect(await screen.findByRole("link", { name: "← Wszystkie wywołania" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]!.querySelector("details")).toHaveAttribute("open");
  });

  it("zakładka LLM w panelu admina", async () => {
    renderAt("/admin/llm", { admin: true, tables: { llm_calls: [], wa_groups: [] } });
    expect(await screen.findByText("Brak wywołań w ostatnich 14 dniach.")).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Panel admina" })).getByRole("link", { name: "LLM" })).toHaveAttribute("href", "/admin/llm");
  });
});
