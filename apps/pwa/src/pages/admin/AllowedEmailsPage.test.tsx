import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { App } from "../../App";
import { AuthProvider } from "../../auth/AuthProvider";
import { adminProfile, fakeSupabase, familyProfile } from "../../test/fakeSupabase";

const list = [
  { email: adminProfile.email, role: "admin" as const, created_at: "" },
  { email: familyProfile.email, role: "family" as const, created_at: "" },
];

function renderAdmin(fake: ReturnType<typeof fakeSupabase>) {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <AuthProvider client={fake.client}>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Admin → Lista rodziny", () => {
  it("dodaje adres przez RPC admina", async () => {
    const fake = fakeSupabase({ userId: adminProfile.id, profile: adminProfile, allowedEmails: list });
    renderAdmin(fake);
    await userEvent.type(await screen.findByLabelText("Adres e-mail"), "babcia@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Dodaj" }));
    expect(fake.rpc).toHaveBeenCalledWith("admin_upsert_allowed_email", { p_email: "babcia@example.com", p_role: "family" });
    expect(await screen.findByText("babcia@example.com")).toBeInTheDocument();
  });

  it("nie pozwala usunąć ani zdegradować siebie", async () => {
    renderAdmin(fakeSupabase({ userId: adminProfile.id, profile: adminProfile, allowedEmails: list }));
    const me = (await screen.findByText(adminProfile.email)).closest("li")!;
    expect(within(me).getByRole("button", { name: /Usuń/ })).toBeDisabled();
    expect(within(me).getByRole("combobox")).toBeDisabled();
  });

  it("pokazuje błąd zwrócony przez bazę", async () => {
    const fake = fakeSupabase({
      userId: adminProfile.id,
      profile: adminProfile,
      allowedEmails: list,
      rpcError: "Niepoprawny adres e-mail.",
    });
    renderAdmin(fake);
    await userEvent.type(await screen.findByLabelText("Adres e-mail"), "x@y.pl");
    await userEvent.click(screen.getByRole("button", { name: "Dodaj" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Niepoprawny adres e-mail.");
  });

  it("członek rodziny nie ma dostępu do panelu", async () => {
    renderAdmin(fakeSupabase({ userId: familyProfile.id, profile: familyProfile }));
    expect(await screen.findByRole("heading", { name: "Dziś i jutro" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Lista rodziny" })).not.toBeInTheDocument();
  });
});
