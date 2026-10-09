import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderAt } from "../../test/render";

type Tables = Record<string, Record<string, unknown>[]>;

const members = [
  { email: "ola@example.com", display_name: "Ola", role: "family", signed_in: true, is_me: true, invited: false },
  { email: "marek@example.com", display_name: null, role: "family", signed_in: false, is_me: false, invited: false },
];

const rpc = {
  family_members: (_: Record<string, unknown>, tables: Tables) => tables.members,
  family_add_member: (args: Record<string, unknown>, tables: Tables) => {
    const invited = args.p_email === "tata@example.com";
    tables.members!.push({ email: args.p_email, display_name: null, role: "family", signed_in: false, is_me: false, invited });
    return invited ? "invited" : "added";
  },
  family_remove_member: (args: Record<string, unknown>, tables: Tables) => {
    tables.members = tables.members!.filter((m) => m.email !== args.p_email);
  },
};

describe("Ustawienia → Moja rodzina", () => {
  it("pokazuje członków, dodaje i usuwa adres (nie siebie)", async () => {
    const { rpc: calls } = renderAt("/ustawienia", { tables: { members: [...members] }, rpc });
    const section = await screen.findByRole("region", { name: "Moja rodzina" });
    expect(await within(section).findByText("Ola")).toBeInTheDocument();
    expect(within(section).getByText("jeszcze się nie zalogował(a)")).toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: "Usuń ola@example.com" })).not.toBeInTheDocument();

    await userEvent.type(within(section).getByRole("textbox", { name: "Adres e-mail członka rodziny" }), "babcia@example.com");
    await userEvent.click(within(section).getByRole("button", { name: "Dodaj" }));
    expect(calls).toHaveBeenCalledWith("family_add_member", { p_email: "babcia@example.com" });
    expect(await within(section).findByText("babcia@example.com")).toBeInTheDocument();

    window.confirm = () => true;
    await userEvent.click(within(section).getByRole("button", { name: "Usuń marek@example.com" }));
    await waitFor(() => expect(within(section).queryByText("marek@example.com")).not.toBeInTheDocument());
  });


  it("adres z innej rodziny dostaje zaproszenie, które można anulować", async () => {
    const { rpc: calls } = renderAt("/ustawienia", { tables: { members: [...members] }, rpc });
    const section = await screen.findByRole("region", { name: "Moja rodzina" });
    await within(section).findByText("Ola");
    await userEvent.type(within(section).getByRole("textbox", { name: "Adres e-mail członka rodziny" }), "tata@example.com");
    await userEvent.click(within(section).getByRole("button", { name: "Dodaj" }));
    expect(await within(section).findByRole("status")).toHaveTextContent("wysłaliśmy zaproszenie");
    expect(await within(section).findByText("zaproszenie wysłane")).toBeInTheDocument();
    window.confirm = () => true;
    await userEvent.click(within(section).getByRole("button", { name: "Anuluj zaproszenie tata@example.com" }));
    expect(calls).toHaveBeenCalledWith("family_remove_member", { p_email: "tata@example.com" });
  });
});
