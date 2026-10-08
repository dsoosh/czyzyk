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

describe("Kalendarz – wpisy kilkudniowe", () => {
  const spanTables = {
    ...tables,
    events: [
      f.event({ id: "w", title: "Wycieczka", starts_at: "2026-10-04T22:00:00.000Z", ends_at: "2026-10-07T22:00:00.000Z" }),
      f.event({ id: "z1", title: "Zielona szkoła – dzień 1", starts_at: "2026-10-19T22:00:00.000Z" }),
      f.event({ id: "z2", title: "Zielona szkoła – dzień 2", starts_at: "2026-10-20T22:00:00.000Z" }),
    ],
    closures: [
      f.closure({ id: "c1", date_from: "2026-10-26", date_to: "2026-10-28", reason: "przerwa jesienna" }),
      f.closure({ id: "c2", date_from: "2026-10-29", date_to: "2026-10-30", reason: "przerwa jesienna" }),
    ],
  };

  it("lista pokazuje wpis kilkudniowy raz, w sekcji z zakresem dat w nagłówku", async () => {
    renderAt("/kalendarz", { tables: spanTables });
    const trip = await screen.findByRole("region", { name: "Poniedziałek 5.10 – Czwartek 8.10" });
    expect(within(trip).getByText("Wycieczka")).toBeInTheDocument();
    expect(within(trip).getByRole("heading")).toHaveTextContent("Poniedziałek 5.10 – Czwartek 8.10 · trwa");
    expect(screen.queryByRole("region", { name: "Czwartek 8.10" })).not.toBeInTheDocument();

    expect(screen.getAllByText("Zielona szkoła – dzień 1")).toHaveLength(1);
    expect(screen.queryByText("Zielona szkoła – dzień 2")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Wtorek 20.10 – Środa 21.10" })).toHaveTextContent("Zielona szkoła – dzień 1");

    expect(screen.getAllByText("Przedszkole nieczynne – przerwa jesienna")).toHaveLength(1);
    const autumn = screen.getByRole("region", { name: "Poniedziałek 26.10 – Piątek 30.10" });
    expect(within(autumn).queryByText("pn 26.10 – pt 30.10")).not.toBeInTheDocument();
  });

  it("widok miesiąca oznacza każdy dzień wpisu", async () => {
    renderAt("/kalendarz?miesiac=2026-10", { tables: spanTables });
    expect(await screen.findByRole("button", { name: /^Czwartek 8\.10, 1 wpisy/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Poniedziałek 5\.10, 1 wpisy/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Środa 21\.10, 1 wpisy/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Czwartek 29\.10, 1 wpisy/ }));
    expect(within(screen.getByRole("region", { name: "Wybrany dzień Czwartek 29.10" })).getByText("pn 26.10 – pt 30.10")).toBeInTheDocument();
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

  it("pokazuje pełną historię: wiadomości, zdjęcie dokumentu i zmiany wydarzenia i rzeczy do przyniesienia", async () => {
    const msg = (id: string, sent_at: string, text: string, author = "Pani Ania") => ({
      id, group_id: "g1", author, sent_at, text, has_attachment: false, status: "active",
    });
    const change = (o: Record<string, unknown>) => ({ rationale: null, source_message_ids: [], changes: null, ...o });
    const { rpc } = renderAt("/kalendarz/wydarzenie/e1", {
      tables: {
        ...tables,
        events: [f.event({ source_message_ids: ["m1", "m2"] })],
        bring_items: [f.bring({ source_message_ids: ["m3"] })],
        messages: [
          msg("m1", "2026-10-01T08:00:00.000Z", "W piątek bal"),
          msg("m2", "2026-10-02T08:00:00.000Z", ""),
          msg("m3", "2026-10-03T08:00:00.000Z", "Prosimy o przebrania", "Mama Zosi"),
          msg("m9", "2026-10-03T09:00:00.000Z", "Inna sprawa"),
        ],
        attachments: [
          { id: "a1", message_id: "m2", screening: "image", doc_text: null, description: "Plakat balu", doc_status: "ready" },
          { id: "a2", message_id: "m3", screening: "text_only", doc_text: "Lista: przebranie", description: null, doc_status: "ready" },
        ],
        item_changes: [
          change({ id: "c1", item_type: "event", item_id: "e1", op: "create", source_message_ids: ["m1"], created_at: "2026-10-01T08:01:00.000Z" }),
          change({ id: "c2", item_type: "event", item_id: "e1", op: "update", changes: { start: { from: "2026-10-09", to: "2026-10-10" } }, rationale: "Przesunięty termin.", source_message_ids: ["m2"], created_at: "2026-10-02T08:01:00.000Z" }),
          change({ id: "c3", item_type: "bring_item", item_id: "b1", op: "create", source_message_ids: ["m3"], created_at: "2026-10-03T08:01:00.000Z" }),
          change({ id: "c4", item_type: "event", item_id: "e2", op: "create", created_at: "2026-10-03T08:02:00.000Z" }),
        ],
      },
      rpc: { attachment_image: () => [{ mime: "image/jpeg", data: "AAAA" }] },
    });
    const history = await screen.findByRole("region", { name: "Historia" });
    await within(history).findByText("W piątek bal");
    const items = [...history.querySelector("ol")!.children] as HTMLElement[];
    expect(items.map((li) => li.textContent?.slice(0, 40))).toEqual([
      expect.stringContaining("Pani Ania"),
      expect.stringContaining("Utworzono"),
      expect.stringContaining("Pani Ania"),
      expect.stringContaining("Zmieniono"),
      expect.stringContaining("Mama Zosi"),
      expect.stringContaining("Utworzono · Do przyniesienia: przebranie"),
    ]);
    expect(within(history).queryByText("Inna sprawa")).not.toBeInTheDocument();
    expect(within(items[3]!).getByText("Przesunięty termin.")).toBeInTheDocument();
    expect(await within(history).findByRole("img", { name: "Plakat balu" })).toHaveAttribute("src", "data:image/jpeg;base64,AAAA");
    expect(rpc).toHaveBeenCalledWith("attachment_image", { p_attachment_id: "a1" });
    expect(within(history).getByText("Lista: przebranie")).toBeInTheDocument();
  });
});

