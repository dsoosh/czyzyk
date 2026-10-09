import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { adminProfile, familyProfile, fakeSupabase } from "../test/fakeSupabase";
import { AuthProvider, NO_ACCESS_MESSAGE, readAuthRedirectError } from "./AuthProvider";

function renderApp(fake: ReturnType<typeof fakeSupabase>) {
  return render(
    <MemoryRouter>
      <AuthProvider client={fake.client}>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("bramka dostępu", () => {
  it("bez sesji pokazuje logowanie przez Google", async () => {
    const fake = fakeSupabase({ userId: null });
    renderApp(fake);
    await userEvent.click(await screen.findByRole("button", { name: "Zaloguj przez Google" }));
    expect(fake.auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" }),
    );
  });

  it("zalogowany członek rodziny widzi ekran główny", async () => {
    renderApp(fakeSupabase({ userId: familyProfile.id, profile: familyProfile }));
    expect(await screen.findByRole("heading", { name: "Dziś i jutro" })).toBeInTheDocument();
  });

  it("nowe konto z prośbą o dostęp widzi ekran oczekiwania i nie jest wylogowane", async () => {
    const fake = fakeSupabase({ userId: "u-nowa", profile: null, rpc: { my_access_request: () => "pending" } });
    renderApp(fake);
    expect(await screen.findByRole("heading", { name: "Czekasz na akceptację" })).toBeInTheDocument();
    expect(fake.auth.signOut).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Sprawdź ponownie" }));
    expect(fake.rpc.mock.calls.filter(([name]) => name === "my_access_request")).toHaveLength(2);
  });

  it("odrzucona prośba pokazuje ekran odrzucenia", async () => {
    renderApp(fakeSupabase({ userId: "u-obcy", profile: null, rpc: { my_access_request: () => "rejected" } }));
    expect(await screen.findByRole("heading", { name: "Prośba odrzucona" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zaloguj innym kontem Google" })).toBeInTheDocument();
  });

  it("sesja bez profilu i bez prośby (usunięty członek) kończy się ekranem „Brak dostępu” i wylogowaniem", async () => {
    const fake = fakeSupabase({ userId: "u-obcy", profile: null });
    renderApp(fake);
    expect(await screen.findByRole("heading", { name: "Brak dostępu" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(NO_ACCESS_MESSAGE);
    expect(fake.auth.signOut).toHaveBeenCalled();
  });

  it("błąd hooka w adresie powrotu pokazuje „Brak dostępu”", async () => {
    window.history.replaceState(
      null,
      "",
      "/?error=access_denied&error_description=" + encodeURIComponent("Brak dostępu – konto Google bez adresu e-mail."),
    );
    const fake = fakeSupabase({ userId: null });
    renderApp(fake);
    expect(await screen.findByRole("heading", { name: "Brak dostępu" })).toBeInTheDocument();
    expect(window.location.search).toBe("");
    await userEvent.click(screen.getByRole("button", { name: "Zaloguj innym kontem Google" }));
    expect(fake.auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ queryParams: { prompt: "select_account" } }) }),
    );
  });

  it("zakładka „Admin” jest widoczna tylko dla admina", async () => {
    const { unmount } = renderApp(fakeSupabase({ userId: adminProfile.id, profile: adminProfile }));
    expect(await screen.findByRole("link", { name: "Admin" })).toBeInTheDocument();
    unmount();

    renderApp(fakeSupabase({ userId: familyProfile.id, profile: familyProfile }));
    await screen.findByRole("heading", { name: "Dziś i jutro" });
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });
});

describe("readAuthRedirectError", () => {
  it("czyta błąd z query i z hasha", () => {
    expect(readAuthRedirectError({ search: "?error=server_error", hash: "" })).toBe(NO_ACCESS_MESSAGE);
    expect(readAuthRedirectError({ search: "", hash: "#error=x&error_description=Inny+b%C5%82%C4%85d" })).toBe("Inny błąd");
    expect(readAuthRedirectError({ search: "?code=abc", hash: "" })).toBeNull();
  });

  it("w aplikacji Android logowanie wraca przez czyzyk://auth/callback", async () => {
    (window as { CzyzykAndroid?: unknown }).CzyzykAndroid = { openPhoneSettings: vi.fn() };
    try {
      const fake = fakeSupabase();
      renderApp(fake);
      await userEvent.click(await screen.findByRole("button", { name: "Zaloguj przez Google" }));
      expect(fake.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ options: expect.objectContaining({ redirectTo: "czyzyk://auth/callback" }) }),
      );
    } finally {
      delete (window as { CzyzykAndroid?: unknown }).CzyzykAndroid;
    }
  });
});
