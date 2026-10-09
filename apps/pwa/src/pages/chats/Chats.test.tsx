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
  { id: "r2", group_id: "g2", author: "Mama Zosi", sent_at: "2026-10-07T17:55:00.000Z", text: "Dziękuję!", has_attachment: false, status: "active", triage: "rules" },
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

  it("historia: 20 najnowszych, potem 40, najstarsze u góry", async () => {
    renderAt("/czaty/g1", { tables: { wa_groups: groups, messages } });
    expect(await screen.findByRole("heading", { name: "Motylki" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Wiadomości" });
    let items = within(list).getAllByText(/^wiadomość \d+$/);
    expect(items).toHaveLength(20);
    expect(items[0]).toHaveTextContent("wiadomość 100");
    expect(items.at(-1)).toHaveTextContent("wiadomość 119");
    expect(within(list).getByRole("separator")).toHaveTextContent("dziś");

    await userEvent.click(screen.getByRole("button", { name: "Wcześniejsze wiadomości" }));
    await screen.findByText("wiadomość 80");
    items = within(screen.getByRole("list", { name: "Wiadomości" })).getAllByText(/^wiadomość \d+$/);
    expect(items).toHaveLength(40);
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

  it("linki w treści są klikalne, z krótką nazwą i pełnym adresem w podpowiedzi", async () => {
    const text = "Film: https://m.youtube.com/watch?v=abc. Zapisy: https://forms.gle/xyz";
    renderAt("/czaty/g2", { tables: { wa_groups: groups, messages: [{ ...messages.find((m) => m.id === "r1")!, text }] } });
    const youtube = await screen.findByRole("link", { name: "🔗 YouTube" });
    expect(youtube).toHaveAttribute("href", "https://m.youtube.com/watch?v=abc");
    expect(youtube).toHaveAttribute("title", "https://m.youtube.com/watch?v=abc");
    expect(youtube).toHaveAttribute("rel", "noopener noreferrer nofollow");
    expect(screen.getByRole("link", { name: "🔗 Formularz Google" })).toHaveAttribute("href", "https://forms.gle/xyz");
  });

  it("po kliknięciu wiadomości: werdykt, sprawy z niej i (dla admina) wywołania modelu", async () => {
    const tables = {
      wa_groups: groups,
      messages: [
        { ...messages.find((m) => m.id === "r1")!, processed_at: "2026-10-07T18:01:00.000Z" },
        { ...messages.find((m) => m.id === "r2")!, processed_at: "2026-10-07T17:56:00.000Z" },
      ],
      events: [{ id: "e1", title: "Zebranie", status: "active", source_message_ids: ["r1"] }],
      payments: [{ id: "p1", description: "Składka", status: "needs_review", source_message_ids: ["r1"] }],
      item_changes: [{ item_type: "event", item_id: "e1", op: "create", source_message_ids: ["r1"], created_at: "2026-10-07T18:01:00.000Z" }],
      llm_calls: [
        { id: "c1", kind: "triage", response: { relevant: true, rationale: "Nowy termin zebrania." }, error: null, created_at: "2026-10-07T18:00:30.000Z", message_ids: ["r1"] },
        { id: "c2", kind: "extraction", response: { operations: [{}, {}] }, error: null, created_at: "2026-10-07T18:01:00.000Z", message_ids: ["r1"] },
      ],
    };
    renderAt("/czaty/g2", { admin: true, tables });
    await userEvent.click(await screen.findByText("Zebranie w czwartek"));
    const details = await screen.findByLabelText("Szczegóły wiadomości");
    expect(details).toHaveTextContent("Analiza: Przeanalizowana");
    expect(await within(details).findByRole("link", { name: "Wydarzenie: Zebranie" })).toHaveAttribute("href", "/kalendarz/wydarzenie/e1");
    expect(within(details).getByText(/utworzone/)).toBeInTheDocument();
    expect(within(details).getByRole("link", { name: "Płatność: Składka" })).toHaveAttribute("href", "/zrodlo/payment/p1");
    expect(within(details).getByRole("link", { name: "Wstępna ocena: do analizy" })).toHaveAttribute("href", "/admin/llm?wywolanie=c1");
    expect(within(details).getByText("Nowy termin zebrania.")).toBeInTheDocument();
    expect(within(details).getByRole("link", { name: "Analiza: 2 operacje" })).toBeInTheDocument();

    // A skipped chatter message: its verdict, no items.
    await userEvent.click(screen.getByText("Dziękuję!"));
    expect(await screen.findByText("Pominięta – sama pogawędka (reguły)")).toBeInTheDocument();
  });

  it("członek rodziny widzi werdykt i sprawy, bez wywołań modelu", async () => {
    renderAt("/czaty/g2", {
      tables: {
        wa_groups: groups,
        messages: [{ ...messages.find((m) => m.id === "r1")!, processed_at: null }],
        llm_calls: [{ id: "c1", kind: "triage", response: { relevant: true }, error: null, created_at: "2026-10-07T18:00:30.000Z", message_ids: ["r1"] }],
      },
    });
    await userEvent.click(await screen.findByText("Zebranie w czwartek"));
    const details = await screen.findByLabelText("Szczegóły wiadomości");
    expect(details).toHaveTextContent("Czeka na analizę");
    expect(within(details).queryByRole("link", { name: /Wstępna ocena/ })).not.toBeInTheDocument();
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

  it("oznacza role autorów, wiadomości rodziny i wzmianki o rodzinie", async () => {
    renderAt("/czaty/g2", {
      tables: {
        wa_groups: groups,
        contact_roles: [
          { author_key: "przewodnicząca", role: "dyrekcja", label: null, profile_id: null },
          { author_key: "+48535111213", role: "rodzina", label: "Darek", profile_id: null },
        ],
        messages: [
          { id: "x1", group_id: "g2", author: "Przewodnicząca", sent_at: "2026-10-07T18:00:00.000Z", text: "Zebranie", has_attachment: false, status: "active" },
          { id: "x2", group_id: "g2", author: "+48 535 111 213", sent_at: "2026-10-07T18:01:00.000Z", text: "Będę", has_attachment: false, status: "active" },
          { id: "x3", group_id: "g2", author: "Mama Zosi", sent_at: "2026-10-07T18:02:00.000Z", text: "@48535111213 weźmiesz klucze?", has_attachment: false, status: "active" },
        ],
      },
    });
    const first = (await screen.findByText("Zebranie")).closest("li")!;
    expect(await within(first).findByText("dyrekcja")).toBeInTheDocument();
    const own = screen.getByText("Będę").closest("li")!;
    expect(within(own).getByText("Darek")).toBeInTheDocument();
    const mention = screen.getByText("@48535111213 weźmiesz klucze?").closest("li")!;
    expect(within(mention).getByText("do Was")).toBeInTheDocument();
    expect(within(own).queryByText("do Was")).not.toBeInTheDocument();
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

  it("admin widzi, które wiadomości triaż pominął", async () => {
    renderAt("/czaty/g2", { admin: true, tables: { wa_groups: groups, messages } });
    const skipped = (await screen.findByText("Dziękuję!")).closest("li")!;
    expect(within(skipped).getByText("pominięte – pogawędka")).toBeInTheDocument();
    const analysed = screen.getByText("Zebranie w czwartek").closest("li")!;
    expect(within(analysed).queryByText(/pominięte/)).not.toBeInTheDocument();
  });

  it("zwykły członek rodziny nie widzi znaczników triażu", async () => {
    renderAt("/czaty/g2", { tables: { wa_groups: groups, messages } });
    await screen.findByText("Dziękuję!");
    expect(screen.queryByText(/pominięte/)).not.toBeInTheDocument();
  });
});
