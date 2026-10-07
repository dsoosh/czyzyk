import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtures as f, renderAt } from "../../test/render";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T12:00:00+02:00"));
});
afterEach(() => vi.useRealTimers());

const s = (kind: string, label: string) => ({ kind, label, description: null, due_date: null, amount_pln: null });

const spray = f.action({
  id: "a1",
  question: "Zakup i doniesienie sprayu przeciwko insektom",
  due_date: "2026-10-06",
  suggested_actions: [s("bring", "Do przyniesienia"), s("done", "Zrobione")],
});
const chess = f.action({
  id: "a2",
  question: "Czy Elena chce wziąć udział w zajęciach szachowych od 6.10.2026?",
  due_date: null,
  suggested_actions: [s("answer", "Tak, zapisujemy"), s("answer", "Nie")],
});

/** apply_action_suggestion double: resolves the item with the chosen label. */
const apply = (args: Record<string, unknown>, tables: Record<string, Record<string, unknown>[]>) => {
  const item = tables.action_required!.find((a) => a.id === args.p_id)!;
  const chosen = (item.suggested_actions as { kind: string; label: string }[])[Number(args.p_index)]!;
  Object.assign(item, { resolved_at: "2026-10-05T10:00:00Z", resolved_by: "u-family", resolution: chosen.label });
  return { kind: chosen.kind, created_id: chosen.kind === "bring" ? "b9" : null, due_date: chosen.kind === "bring" ? "2026-10-06" : null };
};

describe("proponowane akcje w „Wymaga odpowiedzi”", () => {
  it("akcje pasują do sprawy: spray ma „Do przyniesienia”, szachy – odpowiedzi", async () => {
    renderAt("/listy/sprawy", { tables: { wa_groups: f.groups, action_required: [spray, chess] } });
    const sprayActions = await screen.findByRole("group", { name: "Proponowane akcje: Zakup i doniesienie sprayu przeciwko insektom" });
    expect(within(sprayActions).getAllByRole("button").map((b) => b.textContent)).toEqual(["Do przyniesienia", "Zrobione"]);
    const chessActions = screen.getByRole("group", { name: /Proponowane akcje: Czy Elena/ });
    expect(within(chessActions).getAllByRole("button").map((b) => b.textContent)).toEqual(["Tak, zapisujemy", "Nie"]);
    expect(within(chessActions).queryByRole("button", { name: "Do przyniesienia" })).not.toBeInTheDocument();
  });

  it("„Do przyniesienia” wywołuje akcję, potwierdza i zamyka sprawę z adnotacją", async () => {
    const { rpc } = renderAt("/listy/sprawy", {
      tables: { wa_groups: f.groups, action_required: [spray] },
      rpc: { apply_action_suggestion: apply },
    });
    const group = await screen.findByRole("group", { name: /Proponowane akcje: Zakup/ });
    await act(async () => userEvent.click(within(group).getByRole("button", { name: "Do przyniesienia" })));
    expect(rpc).toHaveBeenCalledWith("apply_action_suggestion", { p_id: "a1", p_index: 0 });
    expect(await screen.findByRole("status")).toHaveTextContent("Dodano do rzeczy do przyniesienia na jutro.");
    expect(await screen.findByText("„Do przyniesienia”")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Proponowane akcje/ })).not.toBeInTheDocument();
  });

  it("ekran „Dziś” też pokazuje akcje, a sprawa bez propozycji ma tylko odhaczanie", async () => {
    renderAt("/", { tables: { wa_groups: f.groups, action_required: [chess, f.action({ id: "a3", question: "Stara sprawa" })] } });
    const section = await screen.findByRole("region", { name: "Wymaga odpowiedzi" });
    expect(within(section).getByRole("button", { name: "Tak, zapisujemy" })).toBeInTheDocument();
    expect(within(section).queryByRole("group", { name: /Stara sprawa/ })).not.toBeInTheDocument();
  });
});
