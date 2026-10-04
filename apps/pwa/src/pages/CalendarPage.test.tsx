import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtures as f, renderAt } from "../test/render";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T12:00:00+02:00"));
});
afterEach(() => vi.useRealTimers());

const tables = {
  wa_groups: f.groups,
  events: [
    f.event(),
    f.event({ id: "e2", title: "Zebranie", starts_at: "2026-10-15T15:30:00.000Z", all_day: false, location: "sala Motylków" }),
    f.event({ id: "e3", title: "Teatrzyk", starts_at: "2026-10-13T22:00:00.000Z", status: "cancelled" }),
    f.event({ id: "e4", title: "Andrzejki", starts_at: "2026-11-26T23:00:00.000Z" }),
  ],
  closures: [f.closure()],
  bring_items: [f.bring()],
};

describe("Kalendarz – lista", () => {
  it("grupuje aktywne wydarzenia i dni wolne po dniach, ukrywa odwołane", async () => {
    renderAt("/kalendarz", { tables });
    const friday = await screen.findByRole("region", { name: "Piątek 9.10" });
    expect(within(friday).getByText("Bal")).toBeInTheDocument();
    expect(within(friday).getByText("cały dzień")).toBeInTheDocument();
    const thursday = screen.getByRole("region", { name: "Czwartek 15.10" });
    expect(within(thursday).getByText("17:30")).toBeInTheDocument();
    expect(within(thursday).getByText("sala Motylków")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Poniedziałek 12.10" })).toHaveTextContent("Przedszkole nieczynne – dzień nauczyciela");
    expect(screen.queryByText("Teatrzyk")).not.toBeInTheDocument();
  });
});

describe("Kalendarz – miesiąc", () => {
  it("pokazuje elementy wybranego dnia i przełącza miesiące", async () => {
    renderAt("/kalendarz", { tables });
    await userEvent.click(await screen.findByRole("tab", { name: "Miesiąc" }));
    expect(screen.getByRole("heading", { name: "październik 2026" })).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: /^Piątek 9\.10, 1 wpisy/ }));
    expect(within(screen.getByRole("region", { name: "Wybrany dzień Piątek 9.10" })).getByText("Bal")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^Środa 14\.10/ }));
    expect(screen.getByText("Brak wpisów tego dnia")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Następny miesiąc" }));
    expect(screen.getByRole("heading", { name: "listopad 2026" })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: /^Piątek 27\.11, 1 wpisy/ }));
    expect(screen.getByText("Andrzejki")).toBeInTheDocument();
  });

  it("nie oznacza dnia z odwołanym wydarzeniem", async () => {
    renderAt("/kalendarz", { tables });
    await userEvent.click(await screen.findByRole("tab", { name: "Miesiąc" }));
    await screen.findByRole("button", { name: /^Piątek 9\.10, 1 wpisy/ });
    expect(screen.getByRole("button", { name: "Środa 14.10" })).toBeInTheDocument();
  });
});

describe("Szczegóły wydarzenia", () => {
  it("pokazuje termin, grupę, rzeczy do przyniesienia i źródło", async () => {
    renderAt("/kalendarz/wydarzenie/e1", { tables });
    expect(await screen.findByRole("heading", { name: "Bal" })).toBeInTheDocument();
    expect(screen.getByText("Piątek 9.10, cały dzień")).toBeInTheDocument();
    expect(screen.getByText("Motylki")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Do przyniesienia" })).getByText("przebranie")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "skąd to wiem" }).map((a) => a.getAttribute("href"))).toContain("/zrodlo/event/e1");
  });
});
