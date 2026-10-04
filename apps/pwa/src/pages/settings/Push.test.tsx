import { act, fireEvent, screen, within } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as push from "../../lib/push";
import { renderAt } from "../../test/render";

vi.mock("../../lib/push", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/push")>();
  return {
    ...original,
    pushSupport: vi.fn(() => "supported"),
    enablePush: vi.fn(async () => undefined),
    disablePush: vi.fn(async () => undefined),
    currentSubscription: vi.fn(async () => null),
  };
});

const fetchMock = vi.fn();
// Tests run from the repository root or from apps/pwa.
const PWA_ROOT = existsSync("apps/pwa/public") ? "apps/pwa" : ".";

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "https://api.czyzyk.example");
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.mocked(push.pushSupport).mockReturnValue("supported");
  vi.mocked(push.currentSubscription).mockResolvedValue(null);
  vi.mocked(push.enablePush).mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Powiadomienia w ustawieniach", () => {
  it("iPhone w Safari: zamiast prośby o zgodę instrukcja „Udostępnij → Do ekranu początkowego”", async () => {
    vi.mocked(push.pushSupport).mockReturnValue("ios-needs-install");
    renderAt("/ustawienia", { tables: { ical_tokens: [] } });
    const section = await screen.findByRole("region", { name: "Powiadomienia" });
    await act(async () => fireEvent.click(within(section).getByRole("button", { name: "Włącz powiadomienia" })));
    const note = within(section).getByRole("note", { name: "Instrukcja dla iPhone'a" });
    expect(note).toHaveTextContent("Udostępnij");
    expect(note).toHaveTextContent("Do ekranu początkowego");
    expect(push.enablePush).not.toHaveBeenCalled();
  });

  it("włączenie, a potem zmiana godziny skrótu na 20:30", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ digest_enabled: true, digest_time: "20:30", alert_closures: true, alert_actions: false, alert_payments: true }),
        { status: 200 },
      ),
    );
    renderAt("/ustawienia", { tables: { ical_tokens: [] } });
    const section = await screen.findByRole("region", { name: "Powiadomienia" });
    await act(async () => fireEvent.click(within(section).getByRole("button", { name: "Włącz powiadomienia" })));
    expect(push.enablePush).toHaveBeenCalledWith(
      expect.anything(),
      "https://api.czyzyk.example",
      expect.stringMatching(/^BNcR/),
    );
    expect(within(section).getByText("Włączone na tym urządzeniu")).toBeInTheDocument();

    fireEvent.change(within(section).getByLabelText("Godzina"), { target: { value: "20:30" } });
    fireEvent.click(within(section).getByLabelText("Alert: sprawa „wymaga odpowiedzi”"));
    await act(async () => fireEvent.click(within(section).getByRole("button", { name: "Zapisz" })));

    expect(fetchMock).toHaveBeenCalledWith("https://api.czyzyk.example/push/settings", {
      method: "PUT",
      headers: { authorization: "Bearer test-access-token", "content-type": "application/json" },
      body: JSON.stringify({ digest_enabled: true, digest_time: "20:30", alert_closures: true, alert_actions: false, alert_payments: true }),
    });
    expect(within(section).getByRole("status")).toHaveTextContent("Zapisano ustawienia powiadomień.");
  });

  it("odmowa zgody w przeglądarce jest wyjaśniona", async () => {
    vi.mocked(push.enablePush).mockRejectedValueOnce(new Error("permission"));
    renderAt("/ustawienia", { tables: { ical_tokens: [] } });
    const section = await screen.findByRole("region", { name: "Powiadomienia" });
    await act(async () => fireEvent.click(within(section).getByRole("button", { name: "Włącz powiadomienia" })));
    expect(within(section).getByRole("status")).toHaveTextContent("Przeglądarka nie zezwoliła");
  });

  it("zapisane ustawienia są wczytywane z bazy", async () => {
    vi.mocked(push.currentSubscription).mockResolvedValue({} as PushSubscription);
    renderAt("/ustawienia", {
      tables: {
        ical_tokens: [],
        push_settings: [{ digest_enabled: true, digest_time: "20:30:00", alert_closures: false, alert_actions: true, alert_payments: true }],
      },
    });
    const section = await screen.findByRole("region", { name: "Powiadomienia" });
    expect(await within(section).findByDisplayValue("20:30")).toBeInTheDocument();
    expect(within(section).getByLabelText("Alert: dzień wolny")).not.toBeChecked();
  });
});

describe("pushSupport", () => {
  const nav = (o: Record<string, unknown>) => ({ userAgent: "", platform: "", maxTouchPoints: 0, serviceWorker: {}, ...o }) as never;
  const win = (standalone: boolean, extra: Record<string, unknown> = { PushManager: {}, Notification: {} }) =>
    ({ matchMedia: () => ({ matches: standalone }), ...extra }) as never;
  const original = vi.importActual<typeof import("../../lib/push")>("../../lib/push");

  it("wykrywa iPhone'a bez instalacji, także iPadOS jako Mac", async () => {
    const { pushSupport: real } = await original;
    const iphone = nav({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" });
    expect(real(iphone, win(false))).toBe("ios-needs-install");
    expect(real(iphone, win(true))).toBe("supported");
    expect(real(nav({ platform: "MacIntel", maxTouchPoints: 5 }), win(false))).toBe("ios-needs-install");
    expect(real(nav({ standalone: true, userAgent: "iPhone" }), win(false))).toBe("supported");
    expect(real(nav({ userAgent: "Android" }), win(false))).toBe("supported");
    expect(real(nav({ userAgent: "Android" }), win(false, {}))).toBe("unsupported");
  });

  it("dekoduje klucz VAPID z base64url", async () => {
    const { urlBase64ToUint8Array } = await original;
    expect([...urlBase64ToUint8Array("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });
});

describe("Service worker: push-handler.js", () => {
  function loadHandler() {
    const listeners: Record<string, (event: unknown) => void> = {};
    const self = {
      location: { origin: "https://czyzyk.example" },
      addEventListener: (type: string, fn: (event: unknown) => void) => (listeners[type] = fn),
      registration: { showNotification: vi.fn(async () => undefined) },
      clients: { matchAll: vi.fn(async () => []), openWindow: vi.fn(async () => null) },
    };
    const code = readFileSync(resolve(PWA_ROOT, "public/push-handler.js"), "utf8");
    runInNewContext(code, { self, URL });
    return { self, listeners };
  }

  it("wyświetla powiadomienie z treścią z serwera", async () => {
    const { self, listeners } = loadHandler();
    let done: Promise<unknown> = Promise.resolve();
    listeners.push!({
      data: { json: () => ({ title: "Czyżyk", body: "Jutro: strój sportowy", url: "/", tag: "digest-2026-10-09" }) },
      waitUntil: (p: Promise<unknown>) => (done = p),
    });
    await done;
    expect(self.registration.showNotification).toHaveBeenCalledWith("Czyżyk", {
      body: "Jutro: strój sportowy",
      tag: "digest-2026-10-09",
      lang: "pl",
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      data: { url: "/" },
    });
  });

  it("stuknięcie otwiera „Dziś i jutro”, nigdy obcą stronę", async () => {
    const { self, listeners } = loadHandler();
    for (const url of ["/", "https://evil.example/phish"]) {
      let done: Promise<unknown> = Promise.resolve();
      listeners.notificationclick!({
        notification: { close: vi.fn(), data: { url } },
        waitUntil: (p: Promise<unknown>) => (done = p),
      });
      await done;
    }
    expect(self.clients.openWindow.mock.calls).toEqual([["https://czyzyk.example/"], ["https://czyzyk.example/"]]);
  });
});
