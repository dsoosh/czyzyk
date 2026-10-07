import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtures as f, renderAt } from "../test/render";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T12:00:00+02:00"));
});
afterEach(() => vi.useRealTimers());

const messages = Array.from({ length: 40 }, (_, i) => ({
  id: `m${i}`,
  group_id: "g1",
  author: i === 20 ? "Pani Ania" : "Mama Zosi",
  sent_at: new Date(Date.UTC(2026, 9, 7, 14, i)).toISOString(),
  text: i === 20 ? "W piątek bal, przebrania" : `wiadomość ${i}`,
  has_attachment: false,
  status: "active",
}));

/** message_context double: same windowing as the SQL function. */
const messageContext = (args: Record<string, unknown>) => {
  const i = messages.findIndex((m) => m.id === args.p_message_id);
  return messages.slice(Math.max(0, i - Number(args.p_before)), i + 1 + Number(args.p_after));
};

describe("Skąd to wiem", () => {
  it("wyróżnia wiadomość źródłową w kontekście ±10 i pokazuje uzasadnienie oraz pewność", async () => {
    const { rpc } = renderAt("/zrodlo/bring_item/b1", {
      tables: { bring_items: [f.bring({ source_message_ids: ["m20"], confidence: 0.92, rationale: "Na bal potrzebne są przebrania." })] },
      rpc: { message_context: messageContext },
    });
    expect(await screen.findByRole("heading", { name: "przebranie" })).toBeInTheDocument();
    expect(screen.getByText("Pewność: wysoka")).toBeInTheDocument();
    expect(screen.getByText("Na bal potrzebne są przebrania.")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("message_context", { p_message_id: "m20", p_before: 10, p_after: 10 });
    expect(screen.getAllByRole("listitem")).toHaveLength(21);
    const source = screen.getByText("W piątek bal, przebrania").closest("li")!;
    expect(source).toHaveAttribute("aria-current", "true");
    expect(source).toHaveTextContent("Pani Ania");
    expect(source).toHaveTextContent("wczoraj 16:20");
  });

  it("doczytuje wcześniejsze wiadomości", async () => {
    renderAt("/zrodlo/bring_item/b1", {
      tables: { bring_items: [f.bring({ source_message_ids: ["m20"] })] },
      rpc: { message_context: messageContext },
    });
    await screen.findByText("wiadomość 10");
    expect(screen.queryByText("wiadomość 5")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Wcześniejsze wiadomości" }));
    expect(await screen.findByText("wiadomość 5")).toBeInTheDocument();
  });

  it("pokazuje niską i średnią pewność słownie", async () => {
    renderAt("/zrodlo/payment/p1", {
      tables: { payments: [f.payment({ source_message_ids: ["m20"], confidence: 0.5, status: "needs_review" })] },
      rpc: { message_context: messageContext },
    });
    expect(await screen.findByText("Pewność: niska")).toBeInTheDocument();
    expect(screen.getByText("Czeka na sprawdzenie przez administratora.")).toBeInTheDocument();
  });

  it("nieznany typ lub element", async () => {
    renderAt("/zrodlo/cokolwiek/x");
    expect(await screen.findByText("Nie znaleziono elementu.")).toBeInTheDocument();
  });

  it("historia zmian: zmiana godziny z poprzednią wartością i wiadomością, rozmowa wokół najnowszego źródła", async () => {
    const { rpc } = renderAt("/zrodlo/bring_item/b1", {
      tables: {
        bring_items: [f.bring({ source_message_ids: ["m20", "m35"] })],
        messages,
        item_changes: [
          { id: "h1", item_type: "bring_item", item_id: "b1", op: "create", changes: { description: "przebranie", due_date: "2026-10-09" }, source_message_ids: ["m20"], rationale: "Bal.", created_at: "2026-10-07T14:21:00Z" },
          {
            id: "h2",
            item_type: "bring_item",
            item_id: "b1",
            op: "update",
            changes: { due_date: { from: "2026-10-09", to: "2026-10-10" } },
            source_message_ids: ["m35"],
            rationale: "Bal przeniesiony na sobotę.",
            created_at: "2026-10-07T14:36:00Z",
          },
        ],
      },
      rpc: { message_context: messageContext },
    });
    const history = await screen.findByRole("region", { name: "Historia zmian" });
    const entries = within(history).getAllByRole("listitem").filter((li) => li.parentElement?.parentElement === history);
    expect(entries.map((e) => within(e).getAllByText(/Utworzono|Zmieniono/)[0]!.textContent)).toEqual(["Zmieniono", "Utworzono"]);
    expect(entries[0]).toHaveTextContent("Termin: 9.10 → 10.10");
    expect(entries[0]).toHaveTextContent("Bal przeniesiony na sobotę.");
    expect(entries[0]).toHaveTextContent("wiadomość 35");
    expect(entries[1]).toHaveTextContent("W piątek bal, przebrania");
    expect(rpc).toHaveBeenCalledWith("message_context", { p_message_id: "m35", p_before: 10, p_after: 10 });
  });

  it("bez historii (starsze sprawy) pokazuje wszystkie wiadomości źródłowe", async () => {
    renderAt("/zrodlo/bring_item/b1", {
      tables: { bring_items: [f.bring({ source_message_ids: ["m20", "m35"] })], messages, item_changes: [] },
      rpc: { message_context: messageContext },
    });
    const sourcesList = await screen.findByRole("region", { name: "Wiadomości źródłowe" });
    expect(sourcesList).toHaveTextContent("W piątek bal, przebrania");
    expect(sourcesList).toHaveTextContent("wiadomość 35");
  });
});
