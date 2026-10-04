import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminProfile, familyProfile } from "../../test/fakeSupabase";
import { fixtures as f, renderAt } from "../../test/render";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T16:00:00+02:00")); // Thursday 8.10
});
afterEach(() => vi.useRealTimers());

const people = [{ ...adminProfile }];

describe("Do przyniesienia", () => {
  it("grupuje po dniu, najbliższe na górze, i pokazuje kto i kiedy spakował", async () => {
    renderAt("/listy", {
      tables: {
        wa_groups: f.groups,
        profiles: people,
        bring_items: [
          f.bring({ id: "b2", description: "kalosze", due_date: "2026-10-12" }),
          f.bring({ packed_by: adminProfile.id, packed_at: "2026-10-08T18:15:00Z" }),
          f.bring({ id: "b3", description: "stara rzecz", due_date: "2026-10-01" }),
        ],
      },
    });
    const sections = await screen.findAllByRole("region");
    expect(sections.map((s) => s.getAttribute("aria-label"))).toEqual(["Na jutro", "Na pn 12.10"]);
    expect(within(sections[0]!).getByText("spakowane: Darek, 20:15")).toBeInTheDocument();
    expect(screen.queryByText("stara rzecz")).not.toBeInTheDocument();
  });

  it("odhaczenie wywołuje mark_packed i pokazuje „spakowane przez Ciebie”", async () => {
    const { rpc } = renderAt("/listy", { tables: { wa_groups: f.groups, bring_items: [f.bring()] } });
    const box = await screen.findByRole("checkbox", { name: "przebranie" });
    expect(box).toHaveAttribute("aria-checked", "false");
    await act(async () => fireEvent.click(box));
    expect(rpc).toHaveBeenCalledWith("mark_packed", { p_id: "b1", p_done: true });
    expect(await screen.findByText("spakowane przez Ciebie, 16:00")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "przebranie" })).toHaveAttribute("aria-checked", "true");
  });

  it("błąd zapisu jest widoczny", async () => {
    renderAt("/listy", { tables: { wa_groups: f.groups, bring_items: [f.bring()] }, rpcError: "boom" });
    const box = await screen.findByRole("checkbox", { name: "przebranie" });
    await act(async () => fireEvent.click(box));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nie udało się zapisać");
  });
});

describe("Płatności", () => {
  it("po terminie na górze z wyróżnieniem, zapłacone zwinięte z wykonawcą", async () => {
    renderAt("/listy/platnosci", {
      tables: {
        wa_groups: f.groups,
        profiles: people,
        payments: [
          f.payment({ id: "p1", description: "teatrzyk", due_date: "2026-10-10" }),
          f.payment({ id: "p2", description: "wyprawka", due_date: "2026-10-05" }),
          f.payment({ id: "p3", description: "basen", paid_by: adminProfile.id, paid_at: "2026-10-07T08:00:00Z" }),
        ],
      },
    });
    const open = await screen.findByRole("region", { name: "Do zapłaty" });
    const rows = within(open).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("wyprawka");
    expect(rows[0]).toHaveTextContent("po terminie");
    expect(rows[1]).toHaveTextContent("teatrzyk");
    expect(rows[1]).not.toHaveTextContent("po terminie");
    const paid = screen.getByRole("list", { name: "Zapłacone" });
    expect(paid.closest("details")).not.toHaveAttribute("open");
    expect(within(paid).getByText(/zapłacone: Darek, wczoraj 10:00/)).toBeInTheDocument();
  });

  it("oznaczenie i cofnięcie zapłaty", async () => {
    const { rpc } = renderAt("/listy/platnosci", { tables: { wa_groups: f.groups, payments: [f.payment()] } });
    const box = await screen.findByRole("checkbox", { name: "teatrzyk: zapłacone" });
    await act(async () => fireEvent.click(box));
    expect(rpc).toHaveBeenCalledWith("mark_paid", { p_id: "p1", p_done: true });
    expect(await screen.findByText("Wszystko zapłacone")).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("checkbox", { name: "teatrzyk: zapłacone" })));
    expect(rpc).toHaveBeenLastCalledWith("mark_paid", { p_id: "p1", p_done: false });
    expect(await screen.findByText("do zapłaty")).toBeInTheDocument();
  });
});

describe("Wymaga odpowiedzi", () => {
  it("otwarte z terminem, załatwione w zwijanej sekcji", async () => {
    renderAt("/listy/sprawy", {
      tables: {
        wa_groups: f.groups,
        action_required: [
          f.action({ due_date: "2026-10-15" }),
          f.action({ id: "a2", question: "Ankieta", resolved_by: familyProfile.id, resolved_at: "2026-10-08T09:30:00Z" }),
        ],
      },
    });
    const open = await screen.findByRole("region", { name: "Otwarte" });
    expect(within(open).getByText("Zgoda na wycieczkę")).toBeInTheDocument();
    expect(within(open).getByText("do czw 15.10")).toBeInTheDocument();
    const done = screen.getByRole("list", { name: "Załatwione" });
    expect(done.closest("details")).not.toHaveAttribute("open");
    expect(within(done).getByText("załatwione przez Ciebie, 11:30")).toBeInTheDocument();
  });

  it("oznaczenie wywołuje mark_resolved", async () => {
    const { rpc } = renderAt("/listy/sprawy", { tables: { wa_groups: f.groups, action_required: [f.action()] } });
    const box = await screen.findByRole("checkbox", { name: "Zgoda na wycieczkę: załatwione" });
    await act(async () => fireEvent.click(box));
    expect(rpc).toHaveBeenCalledWith("mark_resolved", { p_id: "a1", p_done: true });
  });
});

describe("Dni wolne", () => {
  it("pokazuje nadchodzące z zakresem dat i powodem", async () => {
    renderAt("/listy/dni-wolne", {
      tables: {
        wa_groups: f.groups,
        closures: [
          f.closure({ id: "c2", date_from: "2026-12-23", date_to: "2027-01-01", reason: "przerwa świąteczna" }),
          f.closure(),
          f.closure({ id: "c3", date_from: "2026-10-01", date_to: "2026-10-02", reason: "minione" }),
        ],
      },
    });
    const list = await screen.findByRole("region", { name: "Nadchodzące" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Poniedziałek 12.10 · dzień nauczyciela");
    expect(rows[1]).toHaveTextContent("23.12–1.01 · przerwa świąteczna");
    expect(rows).toHaveLength(2);
  });
});
