import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtures as f, renderAt } from "../test/render";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T16:00:00+02:00")); // Thursday 8.10, tomorrow = Friday 9.10
});
afterEach(() => vi.useRealTimers());

const section = (name: string) => screen.getByRole("region", { name });

describe("Dziś i jutro", () => {
  it("jutro bal: rzecz w „Na jutro przynieść”, wydarzenie z etykietą „jutro”", async () => {
    renderAt("/", { tables: { wa_groups: f.groups, events: [f.event()], bring_items: [f.bring()] } });
    await screen.findByRole("heading", { name: "Dziś i jutro" });
    expect(within(section("Na jutro przynieść")).getByText("przebranie")).toBeInTheDocument();
    const events = section("Wydarzenia");
    expect(within(events).getByText("Bal")).toBeInTheDocument();
    expect(within(events).getByText("jutro")).toBeInTheDocument();
    expect(within(events).getByText("Motylki")).toBeInTheDocument();
    expect(within(events).getByRole("link", { name: "skąd to wiem" })).toHaveAttribute("href", "/zrodlo/event/e1");
  });

  it("ukrywa elementy needs_review i odwołane", async () => {
    renderAt("/", {
      tables: {
        wa_groups: f.groups,
        payments: [f.payment({ status: "needs_review" })],
        events: [f.event({ status: "cancelled" })],
        bring_items: [f.bring({ status: "needs_review" })],
      },
    });
    await screen.findByRole("heading", { name: "Dziś i jutro" });
    expect(screen.queryByText("teatrzyk")).not.toBeInTheDocument();
    expect(screen.queryByText("Bal")).not.toBeInTheDocument();
    expect(screen.getByText("Brak płatności z bliskim terminem")).toBeInTheDocument();
  });

  it("pokazuje puste stany wszystkich sekcji", async () => {
    renderAt("/", { tables: { wa_groups: f.groups } });
    expect(await screen.findByText("Na jutro nic do przyniesienia")).toBeInTheDocument();
    expect(screen.getByText("Brak wydarzeń w najbliższym tygodniu")).toBeInTheDocument();
    expect(screen.getByText("Nic nie czeka na odpowiedź")).toBeInTheDocument();
  });

  it("pokazuje baner zbliżającego się dnia wolnego, ale nie odległego", async () => {
    renderAt("/", { tables: { wa_groups: f.groups, closures: [f.closure(), f.closure({ id: "c2", date_from: "2026-11-11", date_to: "2026-11-11", reason: "święto" })] } });
    expect(await screen.findByRole("status")).toHaveTextContent("Poniedziałek 12.10 – przedszkole nieczynne (dzień nauczyciela)");
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("płatności: kwota, termin, „po terminie”; elementy bez grupy jako „całe przedszkole”", async () => {
    renderAt("/", {
      tables: {
        wa_groups: f.groups,
        payments: [f.payment(), f.payment({ id: "p2", description: "wyprawka", due_date: "2026-10-05", group_id: null, amount_pln: "25.50" })],
      },
    });
    const payments = await screen.findByRole("region", { name: "Płatności" });
    expect(within(payments).getByText("· 10 zł")).toBeInTheDocument();
    expect(within(payments).getByText(/po terminie/)).toBeInTheDocument();
    expect(within(payments).getByText("· 25,5 zł")).toBeInTheDocument();
    expect(within(payments).getByText("całe przedszkole")).toBeInTheDocument();
  });

  it("po powrocie do aplikacji po północy przelicza „dziś” i „jutro”", async () => {
    const { from } = renderAt("/", {
      tables: { wa_groups: f.groups, bring_items: [f.bring(), f.bring({ id: "b2", description: "kalosze", due_date: "2026-10-10" })] },
    });
    expect(await screen.findByText("przebranie")).toBeInTheDocument();
    const calls = from.mock.calls.length;

    vi.setSystemTime(new Date("2026-10-09T07:00:00+02:00"));
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(await screen.findByText("kalosze")).toBeInTheDocument();
    expect(screen.queryByText("przebranie")).not.toBeInTheDocument();
    expect(from.mock.calls.length).toBeGreaterThan(calls);
  });
});
