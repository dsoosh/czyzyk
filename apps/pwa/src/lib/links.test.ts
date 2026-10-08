import { describe, expect, it } from "vitest";
import { linkLabel, splitLinks } from "./links";

describe("splitLinks", () => {
  it("wydziela linki, odcina interpunkcję na końcu zdania i dodaje https do www.", () => {
    expect(splitLinks("Film: https://m.youtube.com/watch?v=GEsq1DHzpI0&t=16. Zapisy na www.zapisy.pl!")).toEqual([
      { text: "Film: " },
      { url: "https://m.youtube.com/watch?v=GEsq1DHzpI0&t=16", label: "YouTube" },
      { text: ". Zapisy na " },
      { url: "https://www.zapisy.pl", label: "zapisy.pl" },
      { text: "!" },
    ]);
  });

  it("nie linkuje innych schematów ani zwykłego tekstu", () => {
    expect(splitLinks("javascript:alert(1) i nic więcej")).toEqual([{ text: "javascript:alert(1) i nic więcej" }]);
  });
});

describe("linkLabel", () => {
  it("krótkie nazwy znanych serwisów, inaczej domena", () => {
    expect(linkLabel("https://docs.google.com/forms/d/e/abc/viewform")).toBe("Formularz Google");
    expect(linkLabel("https://forms.gle/xyz")).toBe("Formularz Google");
    expect(linkLabel("https://docs.google.com/document/d/abc")).toBe("Dokument Google");
    expect(linkLabel("https://maps.app.goo.gl/abc")).toBe("Mapa Google");
    expect(linkLabel("https://www.facebook.com/events/1")).toBe("Facebook");
    expect(linkLabel("https://www.wroclaw.pl/zajezdnia")).toBe("wroclaw.pl/…");
    expect(linkLabel("https://wroclaw.pl")).toBe("wroclaw.pl");
  });
});
