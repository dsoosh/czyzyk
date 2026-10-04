import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { parseForm } from "../../lib/review";
import { fixtures as f, renderAt } from "../../test/render";

const queueEvent = (o: Record<string, unknown> = {}) => ({
  kind: "event",
  id: "e1",
  group_id: "g1",
  status: "needs_review",
  confidence: 0.5,
  rationale: "Niepewna data.",
  source_message_ids: ["m1"],
  pending_patch: null,
  reviewed_at: null,
  updated_at: "2026-10-07T10:00:00Z",
  data: { title: "Teatrzyk", start: "2026-10-09T10:00", end: null, all_day: false, location: null, whole_kindergarten: false },
  ...o,
});
const queuePayment = {
  ...queueEvent(),
  kind: "payment",
  id: "p1",
  data: { description: "basen", amount_pln: 12, due_date: "2026-10-20" },
};

/** review_item removes the item from the fake queue, like the database view would. */
const reviewRpc = {
  review_item: (args: Record<string, unknown>, tables: Record<string, Record<string, unknown>[]>) => {
    tables.review_queue = tables.review_queue!.filter((r) => r.id !== args.p_id);
    return null;
  },
};

function renderQueue(items: Record<string, unknown>[]) {
  return renderAt("/admin/przeglad", { admin: true, tables: { wa_groups: f.groups, review_queue: items }, rpc: reviewRpc });
}

describe("Kolejka przeglądu", () => {
  it("licznik na zakładce Admin i element z typem, danymi, pewnością i uzasadnieniem", async () => {
    renderQueue([queuePayment]);
    const card = await screen.findByRole("listitem", { name: /Płatność/ });
    expect(screen.getByRole("link", { name: /Admin/ })).toHaveTextContent("1");
    expect(within(card).getByText("basen")).toBeInTheDocument();
    expect(within(card).getByText("12 zł")).toBeInTheDocument();
    expect(within(card).getByText("pewność niska (50%)")).toBeInTheDocument();
    expect(within(card).getByText("Niepewna data.")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "skąd to wiem" })).toHaveAttribute("href", "/zrodlo/payment/p1");
  });

  it("zatwierdzenie usuwa element z kolejki i zeruje licznik", async () => {
    const { rpc } = renderQueue([queuePayment]);
    const approve = await screen.findByRole("button", { name: "Zatwierdź" });
    await act(async () => fireEvent.click(approve));
    expect(rpc).toHaveBeenCalledWith("review_item", { p_kind: "payment", p_id: "p1", p_action: "approve", p_patch: null });
    expect(await screen.findByText("Nic nie czeka na przegląd")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Admin/ })).not.toHaveTextContent(/\d/);
  });

  it("odrzucenie wywołuje review_item reject", async () => {
    const { rpc } = renderQueue([queueEvent()]);
    const reject = await screen.findByRole("button", { name: "Odrzuć" });
    await act(async () => fireEvent.click(reject));
    expect(rpc).toHaveBeenCalledWith("review_item", { p_kind: "event", p_id: "e1", p_action: "reject", p_patch: null });
  });

  it("poprawa daty z 9.10 na 16.10 i zatwierdzenie", async () => {
    const { rpc } = renderQueue([queueEvent()]);
    fireEvent.click(await screen.findByRole("button", { name: "Popraw" }));
    fireEvent.change(screen.getByLabelText("Początek"), { target: { value: "2026-10-16T10:00" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Zapisz i zatwierdź" })));
    expect(rpc).toHaveBeenCalledWith("review_item", {
      p_kind: "event",
      p_id: "e1",
      p_action: "approve",
      p_patch: { title: "Teatrzyk", all_day: false, start: "2026-10-16T10:00", end: null, location: null, whole_kindergarten: false },
    });
  });

  it("formularz waliduje wspólnym schematem i nie wysyła błędnych danych", async () => {
    const { rpc } = renderQueue([queueEvent()]);
    fireEvent.click(await screen.findByRole("button", { name: "Popraw" }));
    fireEvent.change(screen.getByLabelText("Tytuł"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz i zatwierdź" }));
    expect(await screen.findByText("Pole „Tytuł” jest wymagane")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalledWith("review_item", expect.anything());
  });

  it("propozycja zmiany elementu zatwierdzonego: przyjęcie lub pozostawienie", async () => {
    const proposal = { op: "update", data: { start: "2026-10-23T10:00" }, confidence: 0.9, rationale: "Przeniesione." };
    const { rpc } = renderQueue([
      queueEvent({ status: "active", reviewed_at: "2026-10-06T10:00:00Z", pending_patch: proposal }),
      queueEvent({ id: "e2", status: "active", reviewed_at: "2026-10-06T10:00:00Z", pending_patch: { op: "update", data: { title: "Bal" } } }),
    ]);
    const cards = await screen.findAllByRole("listitem", { name: /Wydarzenie/ });
    expect(within(cards[0]!).getByText("Nowa wiadomość proponuje zmianę")).toBeInTheDocument();
    expect(within(cards[0]!).getByText("23.10 10:00")).toBeInTheDocument();
    expect(within(cards[0]!).getByText("pewność wysoka (90%)")).toBeInTheDocument();
    await act(async () => fireEvent.click(within(cards[0]!).getByRole("button", { name: "Przyjmij zmianę" })));
    expect(rpc).toHaveBeenCalledWith("review_item", { p_kind: "event", p_id: "e1", p_action: "approve", p_patch: { start: "2026-10-23T10:00" } });

    const rest = await screen.findByRole("listitem", { name: /Wydarzenie/ });
    await act(async () => fireEvent.click(within(rest).getByRole("button", { name: "Zostaw jak jest" })));
    expect(rpc).toHaveBeenLastCalledWith("review_item", { p_kind: "event", p_id: "e2", p_action: "dismiss", p_patch: null });
  });

  it("członek rodziny nie ma zakładki Admin ani dostępu do kolejki", async () => {
    renderAt("/admin/przeglad", { tables: { wa_groups: f.groups } });
    expect(await screen.findByRole("heading", { name: "Dziś i jutro" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Admin/ })).not.toBeInTheDocument();
  });
});

describe("parseForm", () => {
  it("kwota z przecinkiem, puste pola opcjonalne jako null", () => {
    expect(parseForm("payment", { description: " basen ", amount_pln: "12,50", due_date: "" })).toEqual({
      ok: true,
      data: { description: "basen", amount_pln: 12.5, due_date: null },
    });
  });

  it("wydarzenie całodniowe zapisuje samą datę; koniec przed początkiem jest błędem", () => {
    const base = { title: "Bal", all_day: true, start: "2026-10-16T09:00", end: "", location: "", whole_kindergarten: false };
    expect(parseForm("event", base)).toMatchObject({ ok: true, data: { start: "2026-10-16", end: null } });
    expect(parseForm("event", { ...base, end: "2026-10-15" })).toEqual({
      ok: false,
      errors: { end: "Koniec nie może być przed początkiem" },
    });
  });

  it("niepoprawna data i kwota", () => {
    const result = parseForm("payment", { description: "x", amount_pln: "dużo", due_date: "16.10" });
    expect(result).toEqual({
      ok: false,
      errors: { amount_pln: "Podaj kwotę, np. 12,50", due_date: "Pole „Termin” ma niepoprawną wartość" },
    });
  });
});
