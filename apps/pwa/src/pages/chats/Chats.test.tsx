import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { likePattern } from "../../lib/history";
import { renderAt } from "../../test/render";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T12:00:00+02:00"));
});
afterEach(() => vi.useRealTimers());

const groups = [
  { id: "g1", wa_name: "Motylki 2026/27", display_name: "Motylki", tracked: true },
  { id: "g2", wa_name: "Rada rodziców", display_name: null, tracked: true },
  { id: "g3", wa_name: "Sąsiedzi", display_name: null, tracked: false },
];

/** 120 messages of Motylki, one a minute, the newest today at 11:59 Warsaw time. */
const motylki = Array.from({ length: 120 }, (_, i) => ({
  id: `m${i}`,
  group_id: "g1",
  author: i % 2 ? "Pani Ania" : "Mama Zosi",
  sent_at: new Date(Date.UTC(2026, 9, 8, 8, i - 1)).toISOString(),
  text: i === 30 ? "Wycieczka do ZOO w środę" : `wiadomość ${i}`,
  has_attachment: false,
  status: "active",
}));
const messages = [
  ...motylki,
  { id: "r1", group_id: "g2", author: "Przewodnicząca", sent_at: "2026-10-07T18:00:00.000Z", text: "Zebranie w czwartek", has_attachment: false, status: "active" },
  { id: "s1", group_id: "g3", author: "Sąsiad", sent_at: "2026-10-08T09:00:00.000Z", text: "prywatne", has_attachment: false, status: "active" },
];

describe("Czaty", () => {
  it("pokazuje tylko śledzone grupy z ostatnią wiadomością, najświeższe najpierw", async () => {
    renderAt("/czaty", { tables: { wa_groups: groups, messages } });
    const links = await screen.findAllByRole("link", { name: /Motylki|Rada rodziców|Sąsiedzi/ });
    expect(links.map((l) => l.textContent)).toEqual([
      expect.stringContaining("Motylki"),
      expect.stringContaining("Rada rodziców"),
    ]);
    expect(links[0]).toHaveTextContent("Pani Ania: wiadomość 119");
    expect(links[1]).toHaveTextContent("wczoraj 20:00");
    expect(screen.queryByText("Sąsiedzi")).not.toBeInTheDocument();
  });

  it("historia: 50 najnowszych, potem 100, najstarsze u góry", async () => {
    renderAt("/czaty/g1", { tables: { wa_groups: groups, messages } });
    expect(await screen.findByRole("heading", { name: "Motylki" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Wiadomości" });
    let items = within(list).getAllByText(/^wiadomość \d+$/);
    expect(items).toHaveLength(50);
    expect(items[0]).toHaveTextContent("wiadomość 70");
    expect(items.at(-1)).toHaveTextContent("wiadomość 119");
    expect(within(list).getByRole("separator")).toHaveTextContent("dziś");

    await userEvent.click(screen.getByRole("button", { name: "Wcześniejsze wiadomości" }));
    await screen.findByText("wiadomość 20");
    items = within(screen.getByRole("list", { name: "Wiadomości" })).getAllByText(/^wiadomość \d+$|Wycieczka/);
    expect(items).toHaveLength(100);
  });

  it("wyszukuje w treści bez rozróżniania wielkości liter, tylko w tej grupie", async () => {
    renderAt("/czaty/g1", { tables: { wa_groups: groups, messages } });
    await screen.findByRole("heading", { name: "Motylki" });
    await userEvent.type(screen.getByRole("searchbox", { name: "Szukaj w wiadomościach" }), "wycieczk");
    await userEvent.click(screen.getByRole("button", { name: "Szukaj" }));
    expect(await screen.findByText("Wycieczka do ZOO w środę")).toBeInTheDocument();
    expect(screen.queryByText("wiadomość 119")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Wcześniejsze wiadomości" })).not.toBeInTheDocument();
  });

  it("treść jest zwykłym tekstem", async () => {
    renderAt("/czaty/g2", {
      tables: {
        wa_groups: groups,
        messages: [{ ...messages.find((m) => m.id === "r1")!, text: "<b>zebranie</b>" }],
      },
    });
    expect(await screen.findByText("<b>zebranie</b>")).toBeInTheDocument();
  });

  it("admin wysyła wiadomość do ponownej analizy; zwykły członek rodziny nie widzi przycisku", async () => {
    const { rpc } = renderAt("/czaty/g2", { admin: true, tables: { wa_groups: groups, messages }, rpc: { admin_reprocess_message: () => null } });
    const message = (await screen.findByText("Zebranie w czwartek")).closest("li")!;
    await userEvent.click(within(message).getByRole("button", { name: "Analizuj ponownie" }));
    expect(rpc).toHaveBeenCalledWith("admin_reprocess_message", { p_id: "r1" });
    expect(await within(message).findByRole("status")).toHaveTextContent("Wiadomość wróciła do analizy");
  });

  it("bez uprawnień admina nie ma przycisku ponownej analizy", async () => {
    renderAt("/czaty/g2", { tables: { wa_groups: groups, messages } });
    await screen.findByText("Zebranie w czwartek");
    expect(screen.queryByRole("button", { name: "Analizuj ponownie" })).not.toBeInTheDocument();
  });

  it("menu ma zakładkę Czaty", async () => {
    renderAt("/czaty", { tables: { wa_groups: groups, messages } });
    expect(await screen.findByRole("link", { name: "Czaty" })).toHaveAttribute("href", "/czaty");
  });
});

describe("likePattern", () => {
  it("escapuje znaki specjalne LIKE", () => {
    expect(likePattern(" 100% _x\\ ")).toBe("%100\\% \\_x\\\\%");
  });
});
