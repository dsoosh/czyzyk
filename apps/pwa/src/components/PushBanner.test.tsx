import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as push from "../lib/push";
import { renderAt } from "../test/render";

vi.mock("../lib/push", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/push")>();
  return {
    ...original,
    pushSupport: vi.fn(() => "supported"),
    enablePush: vi.fn(async () => undefined),
    currentSubscription: vi.fn(async () => null),
    notificationPermission: vi.fn(() => "default"),
  };
});

const BANNER = { name: "Włącz powiadomienia" };

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "https://api.czyzyk.example");
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM");
  localStorage.clear();
  vi.mocked(push.pushSupport).mockReturnValue("supported");
  vi.mocked(push.currentSubscription).mockResolvedValue(null);
  vi.mocked(push.notificationPermission).mockReturnValue("default");
  vi.mocked(push.enablePush).mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  delete (window as { CzyzykAndroid?: unknown }).CzyzykAndroid;
});

async function settle() {
  await act(async () => {});
}

describe("Baner powiadomień", () => {
  it("pierwsze uruchomienie: baner jest, ale okienko zgody nie pojawia się samo", async () => {
    renderAt("/");
    expect(await screen.findByRole("region", BANNER)).toBeInTheDocument();
    expect(push.enablePush).not.toHaveBeenCalled();
  });

  it("„Włącz” subskrybuje urządzenie i chowa baner", async () => {
    renderAt("/");
    const banner = await screen.findByRole("region", BANNER);
    await act(async () => fireEvent.click(within(banner).getByRole("button", { name: "Włącz" })));
    expect(push.enablePush).toHaveBeenCalledWith(expect.anything(), "https://api.czyzyk.example", expect.stringMatching(/^BNcR/));
    expect(screen.queryByRole("region", BANNER)).not.toBeInTheDocument();
  });

  it("odmowa w okienku przeglądarki chowa baner", async () => {
    vi.mocked(push.enablePush).mockImplementation(async () => {
      vi.mocked(push.notificationPermission).mockReturnValue("denied");
      throw new Error("permission");
    });
    renderAt("/");
    const banner = await screen.findByRole("region", BANNER);
    await act(async () => fireEvent.click(within(banner).getByRole("button", { name: "Włącz" })));
    expect(screen.queryByRole("region", BANNER)).not.toBeInTheDocument();
  });

  it("„Nie teraz” chowa baner na 30 dni", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    const first = renderAt("/");
    const banner = await screen.findByRole("region", BANNER);
    fireEvent.click(within(banner).getByRole("button", { name: "Nie teraz" }));
    expect(screen.queryByRole("region", BANNER)).not.toBeInTheDocument();
    first.unmount();

    vi.setSystemTime(new Date("2026-11-30T10:00:00Z"));
    const second = renderAt("/");
    await settle();
    expect(screen.queryByRole("region", BANNER)).not.toBeInTheDocument();
    second.unmount();

    vi.setSystemTime(new Date("2026-12-01T10:00:01Z"));
    renderAt("/");
    expect(await screen.findByRole("region", BANNER)).toBeInTheDocument();
  });

  it("brak banera, gdy zgoda została odrzucona", async () => {
    vi.mocked(push.notificationPermission).mockReturnValue("denied");
    renderAt("/");
    await settle();
    expect(screen.queryByRole("region", BANNER)).not.toBeInTheDocument();
  });

  it("brak banera, gdy urządzenie ma już subskrypcję", async () => {
    vi.mocked(push.currentSubscription).mockResolvedValue({ endpoint: "https://push.example/1" } as PushSubscription);
    renderAt("/");
    await settle();
    expect(screen.queryByRole("region", BANNER)).not.toBeInTheDocument();
  });

  it("brak banera bez obsługi push i w aplikacji Czyżyk Connect", async () => {
    vi.mocked(push.pushSupport).mockReturnValue("unsupported");
    const view = renderAt("/");
    await settle();
    expect(screen.queryByRole("region", BANNER)).not.toBeInTheDocument();
    view.unmount();

    vi.mocked(push.pushSupport).mockReturnValue("supported");
    (window as { CzyzykAndroid?: unknown }).CzyzykAndroid = {};
    renderAt("/");
    await settle();
    expect(screen.queryByRole("region", BANNER)).not.toBeInTheDocument();
  });

  it("brak banera w Ustawieniach", async () => {
    renderAt("/ustawienia", { tables: { ical_tokens: [] } });
    await screen.findByRole("region", { name: "Powiadomienia" });
    await settle();
    expect(screen.queryByRole("region", BANNER)).not.toBeInTheDocument();
  });

  it("iPhone w Safari: „Włącz” pokazuje instrukcję zamiast prośby o zgodę", async () => {
    vi.mocked(push.pushSupport).mockReturnValue("ios-needs-install");
    vi.mocked(push.notificationPermission).mockReturnValue(null);
    renderAt("/");
    const banner = await screen.findByRole("region", BANNER);
    fireEvent.click(within(banner).getByRole("button", { name: "Włącz" }));
    expect(within(banner).getByRole("note", { name: "Instrukcja dla iPhone'a" })).toHaveTextContent("Do ekranu początkowego");
    expect(push.enablePush).not.toHaveBeenCalled();
  });
});
