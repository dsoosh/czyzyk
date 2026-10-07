import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { familyProfile } from "../../test/fakeSupabase";
import { renderAt } from "../../test/render";

const authors = [
  { author: "+48 535 111 213", messages: 3, last_at: "2026-10-07T10:00:00Z" },
  { author: "Pani Ania", messages: 12, last_at: "2026-10-06T10:00:00Z" },
  { author: "+48535111213", messages: 1, last_at: "2026-10-01T10:00:00Z" },
];

/** admin_save_contact_role double. */
const saveRole = (args: Record<string, unknown>, tables: Record<string, Record<string, unknown>[]>) => {
  const rest = (tables.contact_roles ?? []).filter((r) => r.author_key !== args.p_key);
  tables.contact_roles = args.p_role ? [...rest, { author_key: args.p_key, role: args.p_role, label: args.p_label, profile_id: null }] : rest;
  return null;
};

describe("Admin → Kontakty", () => {
  it("łączy pisownie jednego numeru i nadaje rolę z opisem", async () => {
    const { rpc } = renderAt("/admin/kontakty", {
      admin: true,
      tables: { contact_roles: [] },
      rpc: { list_message_authors: () => authors, admin_save_contact_role: saveRole },
    });
    const ania = await screen.findByRole("form", { name: "Pani Ania" });
    expect(screen.getAllByRole("form")).toHaveLength(2);
    expect(within(screen.getByRole("form", { name: "+48 535 111 213" })).getByText(/4 wiad\./)).toBeInTheDocument();

    await userEvent.selectOptions(within(ania).getByRole("combobox", { name: "Rola" }), "ciocia");
    await userEvent.type(within(ania).getByRole("textbox", { name: "Opis" }), "Ciocia Ania (Sokoły)");
    await userEvent.click(within(ania).getByRole("button", { name: "Zapisz" }));
    expect(rpc).toHaveBeenCalledWith("admin_save_contact_role", { p_key: "pani ania", p_role: "ciocia", p_label: "Ciocia Ania (Sokoły)" });
    const saved = await screen.findByRole("form", { name: "Pani Ania" });
    expect(within(saved).getByRole("combobox", { name: "Rola" })).toHaveValue("ciocia");
  });

  it("pokazuje też numery członków rodziny, które jeszcze nie pisały", async () => {
    renderAt("/admin/kontakty", {
      admin: true,
      tables: { contact_roles: [{ author_key: "+48600700800", role: "rodzina", label: "Ola", profile_id: familyProfile.id }] },
      rpc: { list_message_authors: () => [] },
    });
    const form = await screen.findByRole("form", { name: "+48600700800" });
    expect(within(form).getByText(/numer członka rodziny/)).toBeInTheDocument();
    expect(within(form).getByRole("combobox", { name: "Rola" })).toHaveValue("rodzina");
  });

  it("zakładka jest w panelu admina", async () => {
    renderAt("/admin/kontakty", { admin: true, tables: { contact_roles: [] }, rpc: { list_message_authors: () => [] } });
    expect(await screen.findByRole("link", { name: "Kontakty" })).toHaveAttribute("href", "/admin/kontakty");
  });
});
