import { describe, expect, it } from "vitest";
import { buildSystemPrompt, DEFAULT_PROMPTS, FIXED_PROMPT_PARTS, placeholdersIn, PROMPT_KEYS, unknownPlaceholders } from "./prompts.js";

describe("szablony promptów", () => {
  it("domyślne szablony używają tylko oferowanych placeholderów, a stałe części nie mają żadnych", () => {
    for (const key of PROMPT_KEYS) {
      expect(unknownPlaceholders(key, DEFAULT_PROMPTS[key])).toEqual([]);
      expect(placeholdersIn(FIXED_PROMPT_PARTS[key])).toEqual([]);
    }
    expect(FIXED_PROMPT_PARTS.extraction).toContain("niezaufane dane");
    expect(FIXED_PROMPT_PARTS.assistant).toContain("niezaufane dane");
  });

  it("wykrywa placeholdery ze spacjami i nieznane nazwy", () => {
    expect(placeholdersIn("{{dzieci}} i {{ rodzina }} i znowu {{dzieci}}")).toEqual(["dzieci", "rodzina"]);
    expect(unknownPlaceholders("extraction", "{{uzytkownik}} {{dzieci}} {{coś}}")).toEqual(["uzytkownik", "coś"]);
  });

  it("wypełnia placeholdery jednym przebiegiem, puste jako (brak), i zawsze dopisuje stałą część", () => {
    const system = buildSystemPrompt("assistant", "A {{dzieci}} B {{ rodzina }} C {{uzytkownik}}", {
      dzieci: "{{rodzina}} $& $1",
      rodzina: "  ",
      uzytkownik: "Ola",
    });
    expect(system).toBe(`A {{rodzina}} $& $1 B (brak) C Ola\n\n${FIXED_PROMPT_PARTS.assistant}`);
  });

  it("pusty szablon oznacza domyślny", () => {
    expect(buildSystemPrompt("extraction", "  ", {})).toBe(buildSystemPrompt("extraction", null, {}));
    expect(buildSystemPrompt("extraction", null, {}).startsWith(DEFAULT_PROMPTS.extraction.slice(0, 40))).toBe(true);
  });
});
