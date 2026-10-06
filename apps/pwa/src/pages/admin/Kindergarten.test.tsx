import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderAt } from "../../test/render";

describe("Admin → Przedszkole", () => {
  it("pokazuje opis i zapisuje zmiany przez RPC", async () => {
    const { rpc } = renderAt("/admin/przedszkole", {
      admin: true,
      tables: { kindergarten_profile: [{ content: "Baza – Golędzinów.", updated_at: "2026-10-06T10:00:00Z" }] },
      rpc: {
        admin_update_kindergarten_profile: (args, tables) => {
          tables.kindergarten_profile = [{ content: String(args.p_content), updated_at: "2026-10-06T11:00:00Z" }];
          return tables.kindergarten_profile[0];
        },
      },
    });
    const box = await screen.findByRole("textbox", { name: "Opis przedszkola" });
    expect(box).toHaveValue("Baza – Golędzinów.");
    expect(screen.getByRole("button", { name: "Zapisz" })).toBeDisabled();
    expect(screen.getByText("18 / 8000")).toBeInTheDocument();

    await userEvent.type(box, " Grupa Sokoły – 5 lat.");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(rpc).toHaveBeenCalledWith("admin_update_kindergarten_profile", { p_content: "Baza – Golędzinów. Grupa Sokoły – 5 lat." });
    expect(await screen.findByRole("status")).toHaveTextContent("Zapisano.");
  });

  it("zakładka jest w panelu admina", async () => {
    renderAt("/admin/przedszkole", { admin: true, tables: { kindergarten_profile: [] } });
    expect(await screen.findByRole("link", { name: "Przedszkole" })).toHaveAttribute("href", "/admin/przedszkole");
  });
});
