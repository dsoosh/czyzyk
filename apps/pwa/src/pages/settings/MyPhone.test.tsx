import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { familyProfile } from "../../test/fakeSupabase";
import { renderAt } from "../../test/render";

describe("Ustawienia → Mój numer WhatsApp", () => {
  it("zapisuje numer w postaci +48…, odrzuca tekst i pozwala usunąć", async () => {
    const { rpc } = renderAt("/ustawienia", {
      tables: { ical_tokens: [], contact_roles: [] },
      rpc: {
        set_my_phone: (args, tables) => {
          tables.contact_roles = args.p_key ? [{ author_key: args.p_key, role: "rodzina", label: "Ola", profile_id: familyProfile.id }] : [];
          return null;
        },
      },
    });
    const section = await screen.findByRole("region", { name: "Mój numer WhatsApp" });
    const input = await within(section).findByRole("textbox", { name: "Numer telefonu" });
    await userEvent.type(input, "Ola");
    expect(within(section).getByText(/Wpisz numer telefonu/)).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Zapisz" })).toBeDisabled();

    await userEvent.clear(input);
    await userEvent.type(input, "535 111 213");
    await userEvent.click(within(section).getByRole("button", { name: "Zapisz" }));
    expect(rpc).toHaveBeenCalledWith("set_my_phone", { p_key: "+48535111213" });
    expect(await within(section).findByText("Zapisany numer: +48535111213")).toBeInTheDocument();

    await userEvent.click(within(section).getByRole("button", { name: "Usuń" }));
    expect(rpc).toHaveBeenCalledWith("set_my_phone", { p_key: null });
  });
});
