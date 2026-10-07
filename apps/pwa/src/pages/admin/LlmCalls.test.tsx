import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderAt } from "../../test/render";

const calls = [
  {
    id: "c1",
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
    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("1 operacja")).toBeInTheDocument();
    expect(within(items[0]!).getByText(/1200 → 80 tokenów · 2.4 s/)).toBeInTheDocument();
    expect(within(items[0]!).getByText("Motylki")).toBeInTheDocument();
    await userEvent.click(within(items[0]!).getByText("1 operacja"));
    expect(within(items[0]!).getByText(/W piątek bal/)).toBeInTheDocument();
    expect(within(items[0]!).getByText(/"type": "event"/)).toBeInTheDocument();
    expect(within(items[1]!).getByText("błąd")).toBeInTheDocument();
    expect(within(items[1]!).getByText("Błąd: ExtractionError: no_tool_call")).toBeInTheDocument();
  });

  it("zakładka LLM w panelu admina", async () => {
    renderAt("/admin/llm", { admin: true, tables: { llm_calls: [], wa_groups: [] } });
    expect(await screen.findByText("Brak wywołań w ostatnich 14 dniach.")).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Panel admina" })).getByRole("link", { name: "LLM" })).toHaveAttribute("href", "/admin/llm");
  });
});
