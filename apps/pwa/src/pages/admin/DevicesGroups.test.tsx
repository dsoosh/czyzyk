import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAt } from "../../test/render";
import { pairingLink } from "./DevicesPage";

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "https://api.czyzyk.example");
});
afterEach(() => vi.unstubAllEnvs());

const token = "ab".repeat(32);

describe("Admin → Urządzenia", () => {
  it("dodaje telefon i pokazuje token z kodem QR tylko do zamknięcia okna", async () => {
    const { rpc } = renderAt("/admin/urzadzenia", {
      admin: true,
      tables: { devices: [{ id: "d1", name: "Stary telefon", created_at: "2026-10-01T00:00:00Z", last_seen_at: new Date().toISOString(), revoked_at: null }] },
      rpc: { admin_create_device: (args) => [{ id: "d2", name: args.p_name, token }] },
    });
    expect(await screen.findByText("ostatni kontakt: przed chwilą")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Nazwa urządzenia"), "Telefon Darka");
    await userEvent.click(screen.getByRole("button", { name: "Dodaj telefon" }));
    expect(rpc).toHaveBeenCalledWith("admin_create_device", { p_name: "Telefon Darka" });

    const dialog = await screen.findByRole("dialog", { name: "Parowanie: Telefon Darka" });
    expect(within(dialog).getByDisplayValue(token)).toBeInTheDocument();
    expect(await within(dialog).findByAltText("Kod QR parowania")).toHaveAttribute("src", expect.stringMatching(/^data:image\/png/));
    expect(within(dialog).getByRole("link", { name: /Otwórz w aplikacji/ })).toHaveAttribute(
      "href",
      `czyzyk://pair?server=https%3A%2F%2Fapi.czyzyk.example&token=${token}&app=${encodeURIComponent(window.location.origin)}`,
    );

    await userEvent.click(within(dialog).getByRole("button", { name: "Zamknij" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(token)).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(token);
  });

  it("unieważnia urządzenie po potwierdzeniu", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { rpc } = renderAt("/admin/urzadzenia", {
      admin: true,
      tables: { devices: [{ id: "d1", name: "Telefon", created_at: "2026-10-01T00:00:00Z", last_seen_at: null, revoked_at: null }] },
    });
    expect(await screen.findByText("ostatni kontakt: nigdy")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Odłącz" }));
    expect(rpc).toHaveBeenCalledWith("admin_revoke_device", { p_id: "d1" });
  });

  it("buduje link parowania", () => {
    expect(pairingLink("https://a.b/c", "t")).toBe("czyzyk://pair?server=https%3A%2F%2Fa.b%2Fc&token=t");
    expect(pairingLink("https://a.b/c", "t", "https://pwa.b")).toBe("czyzyk://pair?server=https%3A%2F%2Fa.b%2Fc&token=t&app=https%3A%2F%2Fpwa.b");
  });
});

describe("Admin → Grupy", () => {
  const tables = {
    wa_groups: [
      { id: "g1", wa_name: "Motylki 2026/27", display_name: null, tracked: false },
      { id: "g2", wa_name: "Sąsiedzi", display_name: null, tracked: false },
    ],
  };

  it("włącza śledzenie grupy", async () => {
    const { rpc } = renderAt("/admin/grupy", { admin: true, tables });
    const row = (await screen.findByText("Motylki 2026/27")).closest("li")!;
    await userEvent.click(within(row).getByRole("checkbox", { name: "Śledź" }));
    expect(rpc).toHaveBeenCalledWith("admin_update_group", { p_id: "g1", p_tracked: true, p_display_name: "" });
  });

  it("zapisuje nazwę wyświetlaną", async () => {
    const { rpc } = renderAt("/admin/grupy", { admin: true, tables });
    const row = (await screen.findByText("Motylki 2026/27")).closest("li")!;
    const save = within(row).getByRole("button", { name: "Zapisz" });
    expect(save).toBeDisabled();
    await userEvent.type(within(row).getByLabelText("Nazwa wyświetlana Motylki 2026/27"), "Motylki");
    await userEvent.click(save);
    expect(rpc).toHaveBeenCalledWith("admin_update_group", { p_id: "g1", p_tracked: false, p_display_name: "Motylki" });
  });

  it("dodaje grupę z palca, zanim przyjdzie z niej wiadomość", async () => {
    const { rpc } = renderAt("/admin/grupy", { admin: true, tables });
    const form = await screen.findByRole("form", { name: "Dodaj grupę" });
    const add = within(form).getByRole("button", { name: "Dodaj i śledź" });
    expect(add).toBeDisabled();
    await userEvent.type(within(form).getByLabelText("Nazwa grupy w WhatsAppie"), "Rada rodziców 🌟");
    await userEvent.type(within(form).getByLabelText("Nazwa wyświetlana nowej grupy"), "Rada");
    await userEvent.click(add);
    expect(rpc).toHaveBeenCalledWith("admin_add_group", { p_name: "Rada rodziców 🌟", p_display_name: "Rada" });
    expect(within(form).getByLabelText("Nazwa grupy w WhatsAppie")).toHaveValue("");
  });

  it("jest niedostępny dla członka rodziny", async () => {
    renderAt("/admin/grupy", { tables });
    expect(await screen.findByRole("heading", { name: "Dziś i jutro" })).toBeInTheDocument();
    expect(screen.queryByText("Motylki 2026/27")).not.toBeInTheDocument();
  });
});
