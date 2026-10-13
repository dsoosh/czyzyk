import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { familyProfile } from "../test/fakeSupabase";
import { fixtures as f, renderAt } from "../test/render";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T16:00:00+02:00")); // Thursday 8.10, tomorrow = Friday 9.10
});
afterEach(() => vi.useRealTimers());

const section = (name: string) => screen.getByRole("region", { name });

describe("Dziś i jutro", () => {
  it("jutro bal: „Jutro” pokazuje wydarzenie, gdzie zawieźć dziecko i co przynieść; „Dzisiaj” to zwykły dzień", async () => {
    renderAt("/", {
      tables: {
        wa_groups: f.groups,
        events: [f.event({ location: "Teatr Lalka", drop_offs: [{ place: "Baza", from: "08:30", until: "08:45" }] })],
        bring_items: [f.bring()],
      },
    });
    await screen.findByRole("heading", { name: "Dziś i jutro" });
    expect(section("Dzisiaj")).toHaveTextContent("Zwykły dzień w przedszkolu");
    const tomorrow = section("Jutro");
    expect(tomorrow).toHaveTextContent("Piątek 9.10");
    expect(within(tomorrow).getByRole("link", { name: "Bal" })).toHaveAttribute("href", "/kalendarz/wydarzenie/e1");
    expect(within(tomorrow).getByText("📍 Teatr Lalka")).toBeInTheDocument();
    expect(within(tomorrow).getByText("przebranie")).toBeInTheDocument();
    const where = within(tomorrow).getAllByLabelText("Gdzie przyprowadzić")[0]!;
    expect(where).toHaveTextContent("🏡Bazaod 8:30 do 8:45");
    expect(within(tomorrow).getAllByRole("link", { name: "skąd to wiem" }).map((a) => a.getAttribute("href"))).toContain("/zrodlo/event/e1");
    // Tomorrow is not repeated further down.
    expect(within(section("W najbliższych dniach")).queryByText("przebranie")).not.toBeInTheDocument();
    expect(within(section("Wydarzenia")).queryByText("Bal")).not.toBeInTheDocument();
  });

  it("stałe zajęcia: każde wystąpienie w najbliższym tygodniu z opisem „co …”", async () => {
    const basen = f.event({
      id: "e9",
      title: "Basen",
      starts_at: "2026-09-29T07:00:00.000Z", // a Tuesday, 9:00
      all_day: false,
      repeat_weekdays: [2, 5],
      repeat_until: null,
    });
    renderAt("/", { tables: { wa_groups: f.groups, events: [basen, f.event({ id: "e8", title: "Angielski", repeat_weekdays: [4], repeat_until: null, in_hours: true, starts_at: "2026-10-01T08:00:00.000Z", all_day: false })] } });
    const events = await screen.findByRole("region", { name: "Wydarzenia" });
    // Friday 9.10 is tomorrow; Tuesday 13.10 further in the week from Thursday 8.10.
    expect(within(section("Jutro")).getByText("Basen")).toBeInTheDocument();
    expect(within(events).getAllByText("Basen")).toHaveLength(1);
    expect(within(events).getByText("co wt, pt")).toBeInTheDocument();
    expect(within(events).getByText("wt 13.10")).toBeInTheDocument();
    // Routine classes during kindergarten hours stay out of the home screen.
    expect(screen.queryByText("Angielski")).not.toBeInTheDocument();
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
    expect(await screen.findByText("W najbliższych dniach nic do przyniesienia")).toBeInTheDocument();
    expect(section("Dzisiaj")).toHaveTextContent("Zwykły dzień w przedszkolu");
    expect(section("Jutro")).toHaveTextContent("Zwykły dzień w przedszkolu");
    expect(screen.getByText("Brak dalszych wydarzeń w tym tygodniu")).toBeInTheDocument();
    expect(screen.getByText("Nic nie czeka na odpowiedź")).toBeInTheDocument();
  });

  it("rzeczy: dziś i jutro w swoich dniach, dalej po dacie, bez dalszych terminów", async () => {
    renderAt("/", {
      tables: {
        wa_groups: f.groups,
        bring_items: [
          f.bring({ id: "b1", description: "kalosze", due_date: "2026-10-10" }),
          f.bring({ id: "b2", description: "przebranie", due_date: "2026-10-09" }),
          f.bring({ id: "b3", description: "kanapki", due_date: "2026-10-08" }),
          f.bring({ id: "b4", description: "kasztany", due_date: "2026-10-15" }),
          f.bring({ id: "b5", description: "dynia", due_date: "2026-10-16" }),
          f.bring({ id: "b6", description: "zeszłotygodniowe", due_date: "2026-10-07" }),
        ],
      },
    });
    const today = await screen.findByRole("region", { name: "Dzisiaj" });
    expect(within(today).getByText("kanapki")).toBeInTheDocument();
    expect(within(today).queryByText("przebranie")).not.toBeInTheDocument();
    expect(within(section("Jutro")).getByText("przebranie")).toBeInTheDocument();
    const week = section("W najbliższych dniach");
    expect(within(week).getByText("kalosze").compareDocumentPosition(within(week).getByText("kasztany"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(within(week).getAllByRole("checkbox")).toHaveLength(2);
    expect(within(week).getByText("czw 15.10")).toBeInTheDocument();
    expect(screen.queryByText("dynia")).not.toBeInTheDocument();
    expect(screen.queryByText("zeszłotygodniowe")).not.toBeInTheDocument();
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
    expect(within(payments).getByText("10 zł")).toBeInTheDocument();
    expect(within(payments).getByText(/po terminie/)).toBeInTheDocument();
    expect(within(payments).getByText("25,5 zł")).toBeInTheDocument();
    expect(within(payments).getByText("całe przedszkole")).toBeInTheDocument();
  });

  it("płatność oznaczona jako zapłacona znika z „Dziś”", async () => {
    const { rpc } = renderAt("/", { tables: { wa_groups: f.groups, payments: [f.payment()] } });
    const box = await screen.findByRole("checkbox", { name: "teatrzyk: zapłacone" });
    await act(async () => fireEvent.click(box));
    expect(rpc).toHaveBeenCalledWith("mark_paid", { p_id: "p1", p_done: true });
    expect(await within(section("Płatności")).findByText("Brak płatności z bliskim terminem")).toBeInTheDocument();
  });

  it("po powrocie do aplikacji po północy przelicza „dziś” i „jutro”", async () => {
    const { from } = renderAt("/", {
      tables: { wa_groups: f.groups, bring_items: [f.bring(), f.bring({ id: "b2", description: "kalosze", due_date: "2026-10-10" })] },
    });
    expect(await screen.findByText("przebranie")).toBeInTheDocument();
    const calls = from.mock.calls.length;

    vi.setSystemTime(new Date("2026-10-09T07:00:00+02:00"));
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    // Packed in the morning: yesterday's "tomorrow" is now today's list.
    expect(await within(section("Dzisiaj")).findByText("przebranie")).toBeInTheDocument();
    expect(within(section("Jutro")).getByText("kalosze")).toBeInTheDocument();
    expect(from.mock.calls.length).toBeGreaterThan(calls);
  });
});

describe("Checklista rzeczy do przyniesienia", () => {
  it("stuknięcie wywołuje mark_packed, przekreśla rzecz i podpisuje „spakowane przez Ciebie”", async () => {
    const { rpc } = renderAt("/", { tables: { wa_groups: f.groups, bring_items: [f.bring()] } });
    const box = await screen.findByRole("checkbox", { name: "przebranie" });
    await act(async () => fireEvent.click(box));
    expect(rpc).toHaveBeenCalledWith("mark_packed", { p_id: "b1", p_done: true });
    const list = section("Jutro");
    expect(await within(list).findByText("spakowane przez Ciebie, 16:00")).toBeInTheDocument();
    expect(within(list).getByText("przebranie")).toHaveClass("line-through");
  });

  it("drugi rodzic widzi, kto spakował", async () => {
    renderAt("/", {
      admin: true,
      tables: {
        wa_groups: f.groups,
        profiles: [{ ...familyProfile }],
        bring_items: [f.bring({ packed_by: familyProfile.id, packed_at: "2026-10-08T18:15:00Z" })],
      },
    });
    expect(await screen.findByText("spakowane: Ola, 20:15")).toBeInTheDocument();
  });

  it("bez dzieci: podpowiedź z linkiem do dodania dziecka; z dzieckiem jej nie ma", async () => {
    const { unmount } = renderAt("/", { tables: { wa_groups: f.groups } });
    const hint = await screen.findByRole("region", { name: "Dodaj dziecko" });
    expect(within(hint).getByRole("link", { name: "Dodaj dziecko" })).toHaveAttribute("href", "/ustawienia?dziecko=nowe");
    unmount();
    renderAt("/", { tables: { wa_groups: f.groups, children: [{ id: "k1", name: "Zosia", group_id: "g1", aliases: [], color: "lime" }] } });
    await screen.findByRole("heading", { name: "Dziś i jutro" });
    expect(screen.queryByRole("region", { name: "Dodaj dziecko" })).not.toBeInTheDocument();
  });

  it("zaproszenie do rodziny: „Dołącz” przyjmuje je i odświeża ekran", async () => {
    const invites = [{ id: "inv1", family_name: "Rodzina Oli", invited_by_name: "Ola", created_at: "" }];
    const { rpc } = renderAt("/", {
      tables: { wa_groups: f.groups },
      rpc: {
        my_family_invites: () => invites,
        accept_family_invite: () => {
          invites.length = 0;
        },
      },
    });
    const banner = await screen.findByRole("region", { name: "Zaproszenie do rodziny" });
    expect(banner).toHaveTextContent("Ola zaprasza Cię do rodziny „Rodzina Oli”");
    fireEvent.click(within(banner).getByRole("button", { name: "Dołącz" }));
    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "Zaproszenie do rodziny" })).not.toBeInTheDocument());
    expect(rpc).toHaveBeenCalledWith("accept_family_invite", { p_id: "inv1" });
  });
});
