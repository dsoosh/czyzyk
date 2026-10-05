import { describe, expect, it } from "vitest";
import { withScheme } from "./env";

describe("withScheme", () => {
  it("dodaje https:// do samej domeny z Railway, zostawia pełne adresy", () => {
    expect(withScheme("czyzyk-api.up.railway.app")).toBe("https://czyzyk-api.up.railway.app");
    expect(withScheme("http://localhost:3000/")).toBe("http://localhost:3000");
    expect(withScheme("https://api.example")).toBe("https://api.example");
    expect(withScheme("")).toBeNull();
    expect(withScheme(undefined)).toBeNull();
  });
});
