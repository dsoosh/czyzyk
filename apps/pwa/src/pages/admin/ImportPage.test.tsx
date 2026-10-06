import { act, fireEvent, screen } from "@testing-library/react";
import { strToU8, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAt } from "../../test/render";

const CHAT = [
  "07.10.2026, 18:02 - Pani Ania: W piątek bal jesienny!",
  "07.10.2026, 18:05 - Mama Zosi: IMG-20261007-WA0003.jpg (plik załączony)",
  "Plan na październik",
].join("\n");

const groups = [
  { id: "g1", wa_name: "Motylki 2026/27", display_name: "Motylki", tracked: true },
  { id: "g2", wa_name: "Rada rodziców", display_name: null, tracked: true },
  { id: "g3", wa_name: "Sąsiedzi", display_name: null, tracked: false },
];

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "czyzykapi-production.up.railway.app");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function pick(file: File) {
  const input = (await screen.findByLabelText("Plik eksportu (.txt lub .zip)")) as HTMLInputElement;
  await act(async () => fireEvent.change(input, { target: { files: [file] } }));
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("Admin → Import", () => {
  it("ZIP ze zdjęciem: podgląd, podpowiedź grupy i wysyłka samego tekstu czatu", async () => {
    const photo = new Uint8Array(2048).fill(7);
    const zip = zipSync({ "_chat.txt": strToU8(CHAT), "IMG-20261007-WA0003.jpg": photo });
    fetchMock.mockResolvedValue(ok({ messages: 2, inserted: 2, duplicates: 0, for_extraction: 2, skipped_lines: 0 }));
    renderAt("/admin/import", { admin: true, tables: { wa_groups: groups } });

    await pick(new File([zip], "WhatsApp Chat with Motylki 2026_27.zip", { type: "application/zip" }));
    expect(await screen.findByRole("status", { name: "Podgląd" })).toHaveTextContent("2 wiadomości · 7.10.2026–7.10.2026");
    expect(screen.getByLabelText("Grupa")).toHaveValue("g1");
    expect(screen.queryByRole("option", { name: "Sąsiedzi" })).not.toBeInTheDocument();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Importuj" })));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://czyzykapi-production.up.railway.app/import/chat");
    expect(init.headers).toEqual({ authorization: "Bearer test-access-token", "content-type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ group_id: "g1", text: CHAT, extract_days: 30 });
    expect(init.body.length).toBeLessThan(CHAT.length + 200);

    const result = await screen.findByRole("status", { name: "Wynik importu" });
    expect(result).toHaveTextContent("Nowe wiadomości: 2");
    expect(result).toHaveTextContent("Do analizy: 2");
  });

  it("w aplikacji Android wczytuje czat udostępniony z WhatsAppa (raz)", async () => {
    const takeSharedChat = vi
      .fn()
      .mockReturnValueOnce(JSON.stringify({ fileName: "WhatsApp Chat with Motylki 2026_27.zip", text: CHAT }))
      .mockReturnValue(null);
    (window as { CzyzykAndroid?: unknown }).CzyzykAndroid = { openPhoneSettings: vi.fn(), takeSharedChat };
    try {
      fetchMock.mockResolvedValue(ok({ messages: 2, inserted: 2, duplicates: 0, for_extraction: 2, skipped_lines: 0 }));
      renderAt("/admin/import", { admin: true, tables: { wa_groups: groups } });
      expect(await screen.findByRole("status", { name: "Podgląd" })).toHaveTextContent("2 wiadomości");
      expect(screen.getByLabelText("Grupa")).toHaveValue("g1");
      expect(takeSharedChat).toHaveBeenCalledTimes(1);
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Importuj" })));
      expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ group_id: "g1", text: CHAT, extract_days: 30 });
    } finally {
      delete (window as { CzyzykAndroid?: unknown }).CzyzykAndroid;
    }
  });

  it("plik .txt, ręczny wybór grupy i okresu ekstrakcji", async () => {
    fetchMock.mockResolvedValue(ok({ messages: 2, inserted: 0, duplicates: 2, for_extraction: 0, skipped_lines: 0 }));
    renderAt("/admin/import", { admin: true, tables: { wa_groups: groups } });
    await pick(new File([CHAT], "_chat.txt", { type: "text/plain" }));
    await screen.findByRole("status", { name: "Podgląd" });
    expect(screen.getByLabelText("Grupa")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Importuj" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Grupa"), { target: { value: "g2" } });
    fireEvent.change(screen.getByLabelText(/Wyciągnij wydarzenia/), { target: { value: "0" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Importuj" })));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({ group_id: "g2", extract_days: 0 });
    expect(await screen.findByText("Pominięte (już były): 2")).toBeInTheDocument();
  });

  it("ZIP bez pliku czatu i plik, który nie jest eksportem", async () => {
    renderAt("/admin/import", { admin: true, tables: { wa_groups: groups } });
    await pick(new File([zipSync({ "IMG-1.jpg": new Uint8Array(10) })], "zdjecia.zip"));
    expect(await screen.findByText(/W paczce nie ma pliku czatu/)).toBeInTheDocument();
    await pick(new File(["lista zakupów\nmleko"], "notatka.txt"));
    expect(await screen.findByText(/Nie rozpoznano żadnych wiadomości/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pokazuje błąd serwera po polsku", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "group_not_tracked" }), { status: 422 }));
    renderAt("/admin/import", { admin: true, tables: { wa_groups: groups } });
    await pick(new File([CHAT], "WhatsApp Chat with Motylki 2026_27.txt"));
    await screen.findByRole("status", { name: "Podgląd" });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Importuj" })));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ta grupa nie jest śledzona");
  });

  it("członek rodziny nie ma ekranu importu", async () => {
    renderAt("/admin/import", { tables: { wa_groups: groups } });
    expect(await screen.findByRole("heading", { name: "Dziś i jutro" })).toBeInTheDocument();
  });
});
