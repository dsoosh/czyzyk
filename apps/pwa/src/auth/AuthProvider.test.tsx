import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
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

  it("sesja bez profilu rodziny kończy się ekranem „Brak dostępu” i wylogowaniem", async () => {
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
      "/?error=access_denied&error_description=" + encodeURIComponent("Brak dostępu – ten adres nie jest na liście rodziny."),
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
});
