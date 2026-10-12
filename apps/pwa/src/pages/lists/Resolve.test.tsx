import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtures as f, renderAt } from "../../test/render";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T12:00:00+02:00"));
});
afterEach(() => vi.useRealTimers());

const s = (kind: string, label: string) => ({
  kind,
  label,
  description: null,
  due_date: null,
  amount_pln: null,
});
// A fresh row per test: the mark_resolved double changes it.
const spray = () =>
  f.action({
    id: "a1",
    question: "Zakup i doniesienie sprayu przeciwko insektom",
    due_date: "2026-10-06",
    suggested_actions: [s("bring", "Do przyniesienia"), s("done", "Zrobione")],
  });

describe("„Wymaga odpowiedzi”: tylko „Oznacz jako wykonane”", () => {
  it("lista nie pokazuje proponowanych akcji, przycisk zamyka sprawę", async () => {
    const { rpc } = renderAt("/listy/sprawy", {
      tables: { wa_groups: f.groups, action_required: [spray()] },
    });
    const button = await screen.findByRole("button", {
      name: "Oznacz jako wykonane: Zakup i doniesienie sprayu przeciwko insektom",
    });
    expect(
      screen.queryByRole("button", { name: "Do przyniesienia" }),
    ).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(rpc).toHaveBeenCalledWith("mark_resolved", {
      p_id: "a1",
      p_done: true,
    });
    const done = await screen.findByRole("list", { name: "Załatwione" });
    expect(
      within(done).queryByRole("button", { name: /Oznacz jako wykonane/ }),
    ).not.toBeInTheDocument();
  });

  it("ekran „Dziś” ma ten sam przycisk", async () => {
    const { rpc } = renderAt("/", {
      tables: { wa_groups: f.groups, action_required: [spray()] },
    });
    const section = await screen.findByRole("region", {
      name: "Wymaga odpowiedzi",
    });
    expect(
      within(section).queryByRole("button", { name: "Zrobione" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      within(section).getByRole("button", { name: /Oznacz jako wykonane/ }),
    );
    expect(rpc).toHaveBeenCalledWith("mark_resolved", {
      p_id: "a1",
      p_done: true,
    });
  });
});
