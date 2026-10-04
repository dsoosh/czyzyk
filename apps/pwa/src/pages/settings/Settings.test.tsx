import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calendarLinks } from "../../lib/calendarLinks";
import { renderAt } from "../../test/render";

const TOKEN = "ab".repeat(32);

beforeEach(() => vi.stubEnv("VITE_API_URL", "https://api.czyzyk.example"));
afterEach(() => vi.unstubAllEnvs());

describe("calendarLinks", () => {
  it("buduje webcal://, Google render?cid= i Outlook addfromweb", () => {
    const links = calendarLinks("https://api.czyzyk.example/", TOKEN);
    expect(links.https).toBe(`https://api.czyzyk.example/ical/${TOKEN}.ics`);
    expect(links.webcal).toBe(`webcal://api.czyzyk.example/ical/${TOKEN}.ics`);
    expect(links.google).toBe(
      `https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fapi.czyzyk.example%2Fical%2F${TOKEN}.ics`,
    );
    expect(links.outlook).toBe(
      `https://outlook.live.com/calendar/0/addfromweb?url=https%3A%2F%2Fapi.czyzyk.example%2Fical%2F${TOKEN}.ics&name=Czy%C5%BCyk%20%E2%80%93%20przedszkole`,
    );
  });
});

describe("Mój kalendarz", () => {
  it("wygenerowanie linku pokazuje Google, Apple, Outlook i Kopiuj", async () => {
    const { rpc } = renderAt("/ustawienia", {
      tables: { ical_tokens: [] },
      rpc: {
        create_ical_token: (_args, tables) => {
          tables.ical_tokens = [{ created_at: "2026-10-07T10:00:00Z", revoked_at: null }];
          return TOKEN;
        },
      },
    });
    const section = await screen.findByRole("region", { name: "Mój kalendarz" });
    await act(async () => fireEvent.click(within(section).getByRole("button", { name: "Dodaj do mojego kalendarza" })));
    expect(rpc).toHaveBeenCalledWith("create_ical_token");
    const links = calendarLinks("https://api.czyzyk.example", TOKEN);
    expect(within(section).getByRole("link", { name: "Google" })).toHaveAttribute("href", links.google);
    expect(within(section).getByRole("link", { name: "Apple" })).toHaveAttribute("href", links.webcal);
    expect(within(section).getByRole("link", { name: "Outlook" })).toHaveAttribute("href", links.outlook);
    expect(within(section).getByRole("button", { name: "Kopiuj" })).toBeInTheDocument();
    expect(within(section).getByLabelText("Link do kalendarza")).toHaveValue(links.https);
    expect(await within(section).findByRole("button", { name: "Wygeneruj nowy link" })).toBeInTheDocument();
  });

  it("istniejący link: informacja bez tokenu i możliwość unieważnienia", async () => {
    const { rpc } = renderAt("/ustawienia", {
      tables: { ical_tokens: [{ created_at: "2026-10-07T10:00:00Z", revoked_at: null }] },
      rpc: {
        revoke_ical_token: (_args, tables) => {
          tables.ical_tokens = [];
          return null;
        },
      },
    });
    expect(await screen.findByText(/Masz aktywny link z 7\.10/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Google" })).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Unieważnij link" })));
    expect(rpc).toHaveBeenCalledWith("revoke_ical_token");
    expect(await screen.findByRole("button", { name: "Dodaj do mojego kalendarza" })).toBeInTheDocument();
  });

  it("nagłówek prowadzi do ustawień", async () => {
    renderAt("/");
    expect(await screen.findByRole("link", { name: "Ustawienia" })).toHaveAttribute("href", "/ustawienia");
  });
});
