import { describe, expect, it } from "vitest";
import { mentionsFamily, normalizeAuthor, phoneKey, roleOf, type ContactRoleRow } from "./contacts.js";

describe("autorzy wiadomości", () => {
  it("normalizuje numery telefonu do jednej postaci", () => {
    for (const s of ["+48 535 111 213", "+48535111213", "0048 535-111-213", "535 111 213", "⁨+48 535 111 213⁩"]) {
      expect(normalizeAuthor(s)).toBe("+48535111213");
    }
    expect(normalizeAuthor("+44 20 7946 0958")).toBe("+442079460958");
  });

  it("normalizuje nazwy: wielkość liter, spacje, tylda WhatsAppa", () => {
    expect(normalizeAuthor("~ Ania  Kowalska")).toBe("ania kowalska");
    expect(normalizeAuthor("Pani ANIA")).toBe("pani ania");
    expect(normalizeAuthor("Mama 2")).toBe("mama 2");
  });

  it("phoneKey przyjmuje tylko numery", () => {
    expect(phoneKey("535 111 213")).toBe("+48535111213");
    expect(phoneKey("Ania")).toBeNull();
    expect(phoneKey("123")).toBeNull();
  });

  const roles: ContactRoleRow[] = [
    { author_key: "+48535111213", role: "rodzina", label: "Darek" },
    { author_key: "pani ania", role: "ciocia", label: "Ciocia Ania (Sokoły)" },
  ];

  it("znajduje rolę autora w dowolnej pisowni", () => {
    expect(roleOf(roles, "+48 535 111 213")?.role).toBe("rodzina");
    expect(roleOf(roles, "Pani Ania")?.label).toBe("Ciocia Ania (Sokoły)");
    expect(roleOf(roles, "Mama Zosi")).toBeNull();
  });

  it("rozpoznaje wzmianki o naszej rodzinie po numerze i imieniu", () => {
    expect(mentionsFamily(roles, "@48535111213 proszę o zgodę")).toBe(true);
    expect(mentionsFamily(roles, "@+48 535 111 213 dziękuję")).toBe(true);
    expect(mentionsFamily(roles, "@Darek a Wy?")).toBe(true);
    expect(mentionsFamily(roles, "@48600700800 proszę")).toBe(false);
    expect(mentionsFamily(roles, "Darek bez wzmianki")).toBe(false);
    expect(mentionsFamily([], "@48535111213")).toBe(false);
  });
});
