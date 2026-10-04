import { describe, expect, it } from "vitest";
import { addDays, dayLabel, longDayLabel, monthGrid, startOfWarsawDay, warsawDay, warsawTime } from "./dates";

describe("dates (Europe/Warsaw)", () => {
  it("maps instants to Warsaw days around midnight", () => {
    expect(warsawDay(new Date("2026-10-07T21:59:00Z"))).toBe("2026-10-07");
    expect(warsawDay(new Date("2026-10-07T22:00:00Z"))).toBe("2026-10-08");
    expect(warsawTime("2026-10-15T15:30:00Z")).toBe("17:30");
  });

  it("finds local midnight in summer and winter time and across DST changes", () => {
    expect(startOfWarsawDay("2026-10-09").toISOString()).toBe("2026-10-08T22:00:00.000Z");
    expect(startOfWarsawDay("2026-12-24").toISOString()).toBe("2026-12-23T23:00:00.000Z");
    expect(startOfWarsawDay("2026-10-25").toISOString()).toBe("2026-10-24T22:00:00.000Z"); // DST ends that night
    expect(startOfWarsawDay("2026-10-26").toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect(startOfWarsawDay("2027-03-28").toISOString()).toBe("2027-03-27T23:00:00.000Z"); // DST starts that night
  });

  it("labels days relative to today", () => {
    expect(dayLabel("2026-10-07", "2026-10-07")).toBe("dziś");
    expect(dayLabel("2026-10-08", "2026-10-07")).toBe("jutro");
    expect(dayLabel("2026-10-09", "2026-10-07")).toBe("pt 9.10");
    expect(longDayLabel("2026-10-12")).toBe("Poniedziałek 12.10");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("builds a Monday-first month grid", () => {
    const grid = monthGrid("2026-10");
    expect(grid[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
  });
});
