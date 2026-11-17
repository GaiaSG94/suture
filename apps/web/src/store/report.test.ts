import { describe, expect, it } from "vitest";
import type { ReportEntry } from "@suture/contracts";
import { reportForDisplay } from "./report";

/** The report of a finished combine: one settled cell, applied changes. */
function finishedReport(): ReportEntry[] {
  return [
    {
      category: "applied",
      side: "A",
      sheetName: "Budget",
      ref: "B3",
      label: "2200 → 2400",
    },
    {
      category: "applied",
      side: "A",
      sheetName: "Budget",
      ref: "B5",
      label: "60000 → 61000",
    },
    {
      category: "decided",
      side: "B",
      sheetName: "Sheet 1",
      ref: "B5",
      label: "62000",
    },
    {
      category: "not-carried",
      side: "B",
      sheetName: "Budget",
      label: "Recalculated result — the spreadsheet recalculates it",
    },
  ];
}

const NAMES = new Map<number, string>([[1, "Budget"], [2, "Assumptions"]]);

describe("reportForDisplay", () => {
  it("shows the sheet of a settled cell under its real name", () => {
    const shown = reportForDisplay(finishedReport(), NAMES);
    const settled = shown.filter((entry) => entry.category === "decided");
    expect(settled).toHaveLength(1);
    expect(settled[0]?.sheetName).toBe("Budget");
  });

  it("does not list a settled cell twice — the decision replaces the stale applied line", () => {
    const shown = reportForDisplay(finishedReport(), NAMES);
    const linesOfB5 = shown.filter((entry) => entry.ref === "B5");
    expect(linesOfB5).toHaveLength(1);
    expect(linesOfB5[0]?.category).toBe("decided");
    expect(linesOfB5[0]?.label).toBe("62000");
  });

  it("keeps every other line of the engine report", () => {
    const shown = reportForDisplay(finishedReport(), NAMES);
    expect(shown).toHaveLength(3);
    expect(shown.map((entry) => entry.label)).toContain("2200 → 2400");
    expect(
      shown.some((entry) => entry.category === "not-carried"),
    ).toBe(true);
  });
});
