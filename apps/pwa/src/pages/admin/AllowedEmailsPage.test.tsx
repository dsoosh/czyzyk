import { render, screen, waitFor, within } from "@testing-library/react";
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

describe("Admin → Dostęp", () => {
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
    expect(screen.queryByRole("heading", { name: "Dostęp" })).not.toBeInTheDocument();
  });

  it("akceptuje i odrzuca prośby o dostęp", async () => {
    const approved: unknown[] = [];
    const fake = fakeSupabase({
      userId: adminProfile.id,
      profile: adminProfile,
      allowedEmails: list,
      tables: {
        access_requests: [
          { email: "nowa@example.com", display_name: "Nowa Mama", status: "pending", requested_at: "2026-10-09T10:00:00Z" },
          { email: "obcy@example.com", display_name: null, status: "pending", requested_at: "2026-10-09T11:00:00Z" },
          { email: "stary@example.com", display_name: null, status: "rejected", requested_at: "2026-10-01T11:00:00Z" },
        ],
      },
      rpc: {
        admin_approve_access_request: (args, tables) => {
          approved.push(args);
          tables.access_requests = tables.access_requests!.filter((r) => r.email !== args.p_email);
          tables.allowed_emails!.push({ email: args.p_email, role: "family", created_at: "" });
        },
        admin_reject_access_request: (args, tables) => {
          tables.access_requests!.find((r) => r.email === args.p_email)!.status = "rejected";
        },
      },
    });
    renderAdmin(fake);
    const requests = await screen.findByRole("region", { name: "Prośby o dostęp" });
    expect(await within(requests).findByText("Nowa Mama")).toBeInTheDocument();
    expect(within(requests).queryByText("stary@example.com")).not.toBeInTheDocument();
    await userEvent.click(within(requests).getByRole("button", { name: "Akceptuj nowa@example.com" }));
    expect(approved).toEqual([{ p_email: "nowa@example.com" }]);
    await waitFor(() => expect(within(requests).queryByText("Nowa Mama")).not.toBeInTheDocument());
    expect(screen.getByText("nowa@example.com")).toBeInTheDocument();
    window.confirm = () => true;
    await userEvent.click(within(requests).getByRole("button", { name: "Odrzuć obcy@example.com" }));
    expect(await within(requests).findByText("Nikt nie czeka na dostęp.")).toBeInTheDocument();
  });
});
