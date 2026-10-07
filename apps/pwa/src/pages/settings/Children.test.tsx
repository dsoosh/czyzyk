import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { childNames } from "../../lib/children";
import { fixtures as f, renderAt } from "../../test/render";

const groups = [
  { id: "g1", wa_name: "Motylki 2026/27", display_name: "Motylki", tracked: true },
  { id: "g2", wa_name: "Biedronki", display_name: null, tracked: true },
  { id: "g3", wa_name: "Sąsiedzi", display_name: null, tracked: false },
];

/** save_child double: inserts or updates like the SQL function. */
const saveChild = (args: Record<string, unknown>, tables: Record<string, Record<string, unknown>[]>) => {
  tables.children ??= [];
  if (args.p_id) {
    const row = tables.children.find((c) => c.id === args.p_id)!;
    Object.assign(row, { name: args.p_name, group_id: args.p_group_id, aliases: args.p_aliases });
    return row;
  }
  const row = { id: `c${tables.children.length + 1}`, name: args.p_name, group_id: args.p_group_id, aliases: args.p_aliases };
  tables.children.push(row);
  return row;
};

describe("Ustawienia → Dzieci", () => {
  it("„Dodaj dziecko” dodaje dziecko z imieniem i grupą (tylko śledzone grupy do wyboru)", async () => {
    const { rpc } = renderAt("/ustawienia", { tables: { wa_groups: groups, children: [] }, rpc: { save_child: saveChild } });
    const section = await screen.findByRole("region", { name: "Dzieci" });
    expect(await within(section).findByText("Nie dodano jeszcze dzieci.")).toBeInTheDocument();

    await userEvent.click(within(section).getByRole("button", { name: "Dodaj dziecko" }));
    const form = within(section).getByRole("form", { name: "Nowe dziecko" });
    await userEvent.type(within(form).getByRole("textbox", { name: "Imię" }), " Zosia ");
    const select = within(form).getByRole("combobox", { name: "Grupa" });
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["— bez grupy —", "Motylki", "Biedronki"]);
    await userEvent.selectOptions(select, "g1");
    await userEvent.click(within(form).getByRole("button", { name: "Zapisz" }));

    expect(rpc).toHaveBeenCalledWith("save_child", { p_id: null, p_name: "Zosia", p_group_id: "g1", p_aliases: [] });
    expect(await within(section).findByRole("form", { name: "Zosia" })).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Dodaj dziecko" })).toBeInTheDocument();
  });

  it("zmienia grupę i usuwa dziecko", async () => {
    const { rpc } = renderAt("/ustawienia", {
      tables: { wa_groups: groups, children: [{ id: "c1", name: "Antek", group_id: "g1", aliases: [] }] },
      rpc: { save_child: saveChild, delete_child: (args, tables) => (tables.children = tables.children!.filter((c) => c.id !== args.p_id)) && null },
    });
    const form = await screen.findByRole("form", { name: "Antek" });
    expect(within(form).getByRole("button", { name: "Zapisz" })).toBeDisabled();
    await userEvent.selectOptions(within(form).getByRole("combobox", { name: "Grupa" }), "g2");
    await userEvent.click(within(form).getByRole("button", { name: "Zapisz" }));
    expect(rpc).toHaveBeenCalledWith("save_child", { p_id: "c1", p_name: "Antek", p_group_id: "g2", p_aliases: [] });

    await userEvent.click(within(await screen.findByRole("form", { name: "Antek" })).getByRole("button", { name: "Usuń" }));
    expect(rpc).toHaveBeenCalledWith("delete_child", { p_id: "c1" });
    expect(await screen.findByText("Nie dodano jeszcze dzieci.")).toBeInTheDocument();
  });

  it("inne formy imienia: zapis po przecinkach, odczyt przy dziecku", async () => {
    const { rpc } = renderAt("/ustawienia", {
      tables: { wa_groups: groups, children: [{ id: "c1", name: "Elena", group_id: "g1", aliases: ["El"] }] },
      rpc: { save_child: saveChild },
    });
    const form = await screen.findByRole("form", { name: "Elena" });
    const aliases = within(form).getByRole("textbox", { name: "Inne formy imienia" });
    expect(aliases).toHaveValue("El");
    await userEvent.clear(aliases);
    await userEvent.type(aliases, "Eleonora,  El , , Elcia");
    await userEvent.click(within(form).getByRole("button", { name: "Zapisz" }));
    expect(rpc).toHaveBeenCalledWith("save_child", { p_id: "c1", p_name: "Elena", p_group_id: "g1", p_aliases: ["Eleonora", "El", "Elcia"] });
    expect(await within(await screen.findByRole("form", { name: "Elena" })).findByDisplayValue("Eleonora, El, Elcia")).toBeInTheDocument();
  });

  it("forma należąca do innego dziecka daje czytelny komunikat", async () => {
    renderAt("/ustawienia", {
      tables: { wa_groups: groups, children: [{ id: "c1", name: "Wicek", group_id: null, aliases: [] }] },
      rpc: {
        save_child: () => {
          throw new Error("Forma „wincenty” należy już do innego dziecka.");
        },
      },
    });
    const form = await screen.findByRole("form", { name: "Wicek" });
    await userEvent.type(within(form).getByRole("textbox", { name: "Inne formy imienia" }), "Wincenty");
    await userEvent.click(within(form).getByRole("button", { name: "Zapisz" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("Imię lub forma „wincenty” należy już do innego dziecka.");
  });

  it("duplikat imienia daje czytelny komunikat", async () => {
    renderAt("/ustawienia", {
      tables: { wa_groups: groups, children: [] },
      rpc: {
        save_child: () => {
          throw new Error('duplicate key value violates unique constraint "children_name_key"');
        },
      },
    });
    const section = await screen.findByRole("region", { name: "Dzieci" });
    // The section renders before the children load; wait for the button.
    await userEvent.click(await within(section).findByRole("button", { name: "Dodaj dziecko" }));
    await userEvent.type(within(section).getByRole("textbox", { name: "Imię" }), "Zosia");
    await userEvent.click(within(section).getByRole("button", { name: "Zapisz" }));
    expect(await within(section).findByRole("alert")).toHaveTextContent("Jest już dziecko o tym imieniu.");
  });
});

describe("imię dziecka przy elementach", () => {
  const children = [
    { id: "c1", name: "Zosia", group_id: "g1", aliases: [] },
    { id: "c2", name: "Antek", group_id: "g2", aliases: [] },
  ];

  it("childNames: wprost przypisane, inaczej dzieci z grupy, nic dla całego przedszkola", () => {
    expect(childNames(children, { group_id: "g1", child_ids: ["c2"] })).toEqual(["Antek"]);
    expect(childNames(children, { group_id: "g1", child_ids: [] })).toEqual(["Zosia"]);
    expect(childNames(children, { group_id: "g1" })).toEqual(["Zosia"]);
    expect(childNames(children, { group_id: null, child_ids: [] })).toEqual([]);
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T12:00:00+02:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("Dziś pokazuje imię przy rzeczy do przyniesienia", async () => {
    renderAt("/", {
      tables: {
        wa_groups: f.groups,
        children,
        bring_items: [f.bring({ child_ids: ["c2"] }), f.bring({ id: "b2", description: "kapcie", child_ids: [] })],
      },
    });
    const bring = await screen.findByRole("region", { name: "W najbliższych dniach" });
    expect(within(bring).getByLabelText("Dziecko: Antek")).toBeInTheDocument();
    expect(within(bring).getByLabelText("Dziecko: Zosia")).toBeInTheDocument();
  });
});

describe("Ustawienia telefonu (aplikacja Android)", () => {
  it("przycisk jest tylko w aplikacji i otwiera natywny ekran", async () => {
    const { unmount } = renderAt("/ustawienia", { tables: { wa_groups: [], children: [] } });
    await screen.findByRole("heading", { name: "Ustawienia" });
    expect(screen.queryByRole("button", { name: "Ustawienia telefonu" })).not.toBeInTheDocument();
    unmount();

    const openPhoneSettings = vi.fn();
    (window as { CzyzykAndroid?: unknown }).CzyzykAndroid = { openPhoneSettings };
    try {
      renderAt("/ustawienia", { tables: { wa_groups: [], children: [] } });
      await userEvent.click(await screen.findByRole("button", { name: "Ustawienia telefonu" }));
      expect(openPhoneSettings).toHaveBeenCalledOnce();
    } finally {
      delete (window as { CzyzykAndroid?: unknown }).CzyzykAndroid;
    }
  });
});

describe("Oznaczenie aplikacji Czyżyk Connect", () => {
  it("w aplikacji Android nazwa ma dopisek Connect, w PWA nie", async () => {
    const { unmount } = renderAt("/ustawienia", { tables: { wa_groups: [], children: [] } });
    await screen.findByRole("heading", { name: "Ustawienia" });
    expect(screen.queryByText("Connect")).not.toBeInTheDocument();
    unmount();

    (window as { CzyzykAndroid?: unknown }).CzyzykAndroid = { openPhoneSettings: vi.fn() };
    try {
      renderAt("/ustawienia", { tables: { wa_groups: [], children: [] } });
      await screen.findByRole("heading", { name: "Ustawienia" });
      expect(screen.getByText("Connect")).toBeInTheDocument();
    } finally {
      delete (window as { CzyzykAndroid?: unknown }).CzyzykAndroid;
    }
  });
});
