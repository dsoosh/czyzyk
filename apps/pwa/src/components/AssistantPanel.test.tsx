import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { viewForLocation } from "../lib/assistant";
import { renderAt } from "../test/render";

const GROUP = "2b0d5a2e-3c1f-4d8e-9a6b-7c5d4e3f2a1b";
const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T12:00:00+02:00"));
  vi.stubEnv("VITE_API_URL", "https://api.czyzyk.example");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const answer = (text: string) => new Response(JSON.stringify({ answer: text }), { status: 200, headers: { "content-type": "application/json" } });
const sentBody = (call = 0) => JSON.parse(fetchMock.mock.calls[call]![1].body as string);

async function askQuestion(text: string) {
  await userEvent.type(screen.getByRole("textbox", { name: "Twoje pytanie" }), text);
  await userEvent.click(screen.getByRole("button", { name: "Wyślij" }));
}

describe("Zapytaj", () => {
  it("w widoku miesiąca pyta o ten miesiąc i pokazuje odpowiedź", async () => {
    fetchMock.mockResolvedValue(answer("Pasowanie jest we wtorek 20 października o 10:30."));
    renderAt("/kalendarz?miesiac=2026-10", { tables: {} });
    await userEvent.click(await screen.findByRole("button", { name: "Zapytaj" }));
    expect(screen.getByRole("dialog", { name: "Zapytaj asystenta" })).toHaveTextContent("O: kalendarz – październik 2026");
    await askQuestion("kiedy jest pasowanie?");

    expect(await screen.findByText("Pasowanie jest we wtorek 20 października o 10:30.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("https://api.czyzyk.example/assistant/ask", expect.objectContaining({ method: "POST" }));
    expect(fetchMock.mock.calls[0]![1].headers).toEqual({ authorization: "Bearer test-access-token", "content-type": "application/json" });
    expect(sentBody()).toEqual({ view: { kind: "calendar", month: "2026-10" }, question: "kiedy jest pasowanie?", history: [] });
  });

  it("w historii grupy wysyła id grupy, a kolejne pytanie niesie historię rozmowy", async () => {
    fetchMock.mockResolvedValueOnce(answer("Wycieczka do ZOO w środę.")).mockResolvedValueOnce(answer("Zbiórka o 8:00."));
    renderAt(`/czaty/${GROUP}`, { tables: { wa_groups: [{ id: GROUP, wa_name: "Motylki", display_name: null, tracked: true }], messages: [] } });
    await userEvent.click(await screen.findByRole("button", { name: "Zapytaj" }));
    await askQuestion("co pisali o wycieczce?");
    await screen.findByText("Wycieczka do ZOO w środę.");
    await askQuestion("o której zbiórka?");
    await screen.findByText("Zbiórka o 8:00.");

    expect(sentBody(0).view).toEqual({ kind: "group", id: GROUP });
    expect(sentBody(1)).toEqual({
      view: { kind: "group", id: GROUP },
      question: "o której zbiórka?",
      history: [
        { role: "user", content: "co pisali o wycieczce?" },
        { role: "assistant", content: "Wycieczka do ZOO w środę." },
      ],
    });

    await userEvent.click(screen.getByRole("button", { name: "Nowa rozmowa" }));
    expect(screen.queryByText("Zbiórka o 8:00.")).not.toBeInTheDocument();
  });

  it("pokazuje komunikat o dziennym limicie", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "daily_limit" }), { status: 429 }));
    renderAt("/", { tables: {} });
    await userEvent.click(await screen.findByRole("button", { name: "Zapytaj" }));
    await askQuestion("co jutro?");
    expect(await screen.findByRole("alert")).toHaveTextContent("Wyczerpano dzienny limit pytań – odnowi się jutro.");
    expect(sentBody().view).toEqual({ kind: "today" });
  });

  it("nie ma przycisku w ustawieniach", async () => {
    renderAt("/ustawienia", { tables: {} });
    await screen.findByRole("heading", { name: "Ustawienia" });
    expect(screen.queryByRole("button", { name: "Zapytaj" })).not.toBeInTheDocument();
  });
});

describe("viewForLocation", () => {
  it("mapuje trasy na widoki", () => {
    expect(viewForLocation("/", "")).toEqual({ kind: "today" });
    expect(viewForLocation("/kalendarz", "")).toEqual({ kind: "general" });
    expect(viewForLocation("/kalendarz", "?miesiac=2026-13")).toEqual({ kind: "general" });
    expect(viewForLocation(`/kalendarz/wydarzenie/${GROUP}`, "")).toEqual({ kind: "event", id: GROUP });
    expect(viewForLocation("/listy", "")).toEqual({ kind: "list", list: "bring" });
    expect(viewForLocation("/listy/platnosci", "")).toEqual({ kind: "list", list: "payments" });
    expect(viewForLocation("/czaty", "")).toEqual({ kind: "general" });
    expect(viewForLocation(`/zrodlo/payment/${GROUP}`, "")).toEqual({ kind: "source", item_kind: "payment", id: GROUP });
    expect(viewForLocation("/admin/grupy", "")).toBeNull();
    expect(viewForLocation("/ustawienia", "")).toBeNull();
  });
});
