/**
 * The report as the user reads it.
 *
 * Two corrections are made here, both on the presentation only — the engines
 * keep computing the report exactly as before:
 *
 *  1. a sheet the engine could only name by its number ("Sheet 1") is shown
 *     with its real name ("Budget");
 *  2. a cell the user settled is reported once, in the "settled by you"
 *     section: the automatic line that described the value left aside is
 *     dropped, so the report never shows two different values for one cell.
 */
import type { ReportEntry } from "@suture/contracts";

/** A sheet the engine could only name by its number. */
const NUMBERED_SHEET = /^Sheet (\d+)$/;

/** The real name of a sheet, when the app knows it. */
function realName(sheetName: string, names: ReadonlyMap<number, string>): string {
  const match = NUMBERED_SHEET.exec(sheetName);
  if (match === null) return sheetName;
  return names.get(Number(match[1])) ?? sheetName;
}

/** The key of a cell: its sheet and its address. */
function keyOf(entry: ReportEntry): string | null {
  if (entry.ref === undefined) return null;
  return `${entry.sheetName}:${entry.ref}`;
}

/**
 * The report lines to show, with the sheet names resolved and the cells the
 * user settled reported only once.
 */
export function reportForDisplay(
  report: readonly ReportEntry[],
  names: ReadonlyMap<number, string>,
): ReportEntry[] {
  const named = report.map((entry) => ({ ...entry, sheetName: realName(entry.sheetName, names) }));
  const settled = new Set(
    named
      .filter((entry) => entry.category === "decided")
      .map(keyOf)
      .filter((key): key is string => key !== null),
  );
  return named.filter((entry) => {
    if (entry.category !== "applied") return true;
    const key = keyOf(entry);
    return key === null || !settled.has(key);
  });
}
