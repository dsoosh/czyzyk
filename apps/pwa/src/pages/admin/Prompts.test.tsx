import { DEFAULT_PROMPTS } from "@czyzyk/shared/prompts";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderAt } from "../../test/render";

/** admin_save_llm_prompt double: upserts, or deletes for an empty template. */
const save = (args: Record<string, unknown>, tables: Record<string, Record<string, unknown>[]>) => {
  const rest = (tables.llm_prompts ?? []).filter((r) => r.key !== args.p_key);
  tables.llm_prompts = args.p_template ? [...rest, { key: args.p_key, template: String(args.p_template).trim() }] : rest;
  return null;
};

describe("Admin → Prompty", () => {
  it("pokazuje domyślne prompty, placeholdery i stałą część", async () => {
    renderAt("/admin/prompty", { admin: true, tables: { llm_prompts: [] } });
    const extraction = await screen.findByRole("form", { name: "Analiza wiadomości" });
    expect(within(extraction).getByRole("textbox", { name: "Prompt: Analiza wiadomości" })).toHaveValue(DEFAULT_PROMPTS.extraction);
    expect(within(extraction).getByText("domyślny prompt")).toBeInTheDocument();
    expect(within(extraction).getByRole("button", { name: "Wstaw {{przedszkole}}" })).toBeInTheDocument();
    // Children and families are in the request, not in the extraction prompt (families).
    expect(within(extraction).queryByRole("button", { name: "Wstaw {{dzieci}}" })).not.toBeInTheDocument();
    expect(within(extraction).queryByRole("button", { name: "Wstaw {{uzytkownik}}" })).not.toBeInTheDocument();
    expect(within(extraction).getByText(/niezaufane dane/)).toBeInTheDocument();
    const assistant = screen.getByRole("form", { name: "Asystent „Zapytaj”" });
    expect(within(assistant).getByRole("button", { name: "Wstaw {{uzytkownik}}" })).toBeInTheDocument();
    expect(within(assistant).getByRole("button", { name: "Przywróć domyślny" })).toBeDisabled();
  });

  it("zapisuje własny prompt z placeholderem i przywraca domyślny", async () => {
    const { rpc } = renderAt("/admin/prompty", { admin: true, tables: { llm_prompts: [] }, rpc: { admin_save_llm_prompt: save } });
    const form = await screen.findByRole("form", { name: "Asystent „Zapytaj”" });
    const box = within(form).getByRole("textbox", { name: "Prompt: Asystent „Zapytaj”" });
    fireEvent.change(box, { target: { value: "Odpowiadaj krótko. Pyta: " } });
    await userEvent.click(within(form).getByRole("button", { name: "Wstaw {{uzytkownik}}" }));
    expect(box).toHaveValue("Odpowiadaj krótko. Pyta: {{uzytkownik}}");
    await userEvent.click(within(form).getByRole("button", { name: "Zapisz" }));
    expect(rpc).toHaveBeenCalledWith("admin_save_llm_prompt", { p_key: "assistant", p_template: "Odpowiadaj krótko. Pyta: {{uzytkownik}}" });

    const savedForm = await screen.findByRole("form", { name: "Asystent „Zapytaj”" });
    expect(await within(savedForm).findByText("własny prompt")).toBeInTheDocument();
    expect(within(savedForm).getByRole("status")).toHaveTextContent("Zapisano.");
    await userEvent.click(within(savedForm).getByRole("button", { name: "Przywróć domyślny" }));
    expect(rpc).toHaveBeenCalledWith("admin_save_llm_prompt", { p_key: "assistant", p_template: null });
    const restored = await screen.findByRole("form", { name: "Asystent „Zapytaj”" });
    expect(await within(restored).findByText("domyślny prompt")).toBeInTheDocument();
    expect(within(restored).getByRole("textbox", { name: "Prompt: Asystent „Zapytaj”" })).toHaveValue(DEFAULT_PROMPTS.assistant);
  });

  it("nieznany placeholder blokuje zapis", async () => {
    renderAt("/admin/prompty", { admin: true, tables: { llm_prompts: [] } });
    const form = await screen.findByRole("form", { name: "Analiza wiadomości" });
    fireEvent.change(within(form).getByRole("textbox", { name: "Prompt: Analiza wiadomości" }), { target: { value: "Pyta {{uzytkownik}}" } });
    expect(within(form).getByRole("alert")).toHaveTextContent("Nieznane placeholdery: {{uzytkownik}}");
    expect(within(form).getByRole("button", { name: "Zapisz" })).toBeDisabled();
  });

  it("zakładka jest w panelu admina", async () => {
    renderAt("/admin/prompty", { admin: true, tables: { llm_prompts: [] } });
    expect(await screen.findByRole("link", { name: "Prompty" })).toHaveAttribute("href", "/admin/prompty");
  });
});
