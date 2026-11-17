import { describe, expect, it } from "vitest";
import type {
  CanonicalWorkbook,
  DisagreementChoice,
  MergePlan,
  ReportEntry,
  SutureStore,
} from "@suture/contracts";
import type { SessionState } from "./actions";
import { EMPTY_SESSION } from "./actions";
import { finalizeCombine } from "./finalize";
import type { Engines, HostPorts } from "./ports";
import { createRegistry } from "./registry";

const NOW = 1_793_500_000_000;

/** The plan of the demo case: one disagreement on B5, nothing else. */
const PLAN: MergePlan = {
  carrier: "A",
  patches: [],
  disagreements: [
    {
      id: "1:B5",
      sheetId: 1,
      ref: "B5",
      base: { ref: "B5", kind: "n", input: "60000", cached: "", fmt: "" },
      a: { ref: "B5", kind: "n", input: "61000", cached: "", fmt: "" },
      b: { ref: "B5", kind: "n", input: "62000", cached: "", fmt: "" },
    },
  ],
  fallbacks: [],
  report: [],
};

/** The report the engine returns once the user settled B5 on side B. */
const RESOLVED_REPORT: ReportEntry[] = [
  {
    category: "applied",
    side: "A",
    sheetName: "Budget",
    ref: "B3",
    label: "2200 → 2400",
  },
  {
    category: "decided",
    side: "B",
    sheetName: "Sheet 1",
    ref: "B5",
    label: "62000",
  },
];

/** A workbook with one sheet, enough for the patcher. */
function canonical(): CanonicalWorkbook {
  return {
    meta: {
      sheets: [{ sheetId: 1, name: "Budget", path: "xl/worksheets/sheet1.xml" }],
    },
    sheets: [],
  } as unknown as CanonicalWorkbook;
}

/** A store that records the combine it receives. */
function fakeStore(): SutureStore {
  return {
    listScenarios: async () => [{ name: "reference", head: "v1", reference: true }],
    listVersions: async () => [],
    getParts: async () => [],
    getCanonical: async () => canonical(),
    commitCombine: async () => ({}),
  } as unknown as SutureStore;
}

/** The engine doubles the combine needs. */
function fakeEngines(): Engines {
  return {
    resolveMerge: async () => ({ patches: [], report: RESOLVED_REPORT }),
    patchWorkbook: async () => ({ parts: [], touchedSheets: [], calcChainRemoved: false }),
    zipParts: async () => new Uint8Array([1, 2, 3]),
  } as unknown as Engines;
}

/** The host, with the downloads it receives. */
function fakeHost(downloads: { name: string; bytes: Uint8Array }[]): HostPorts {
  const settings = new Map<string, string>();
  return {
    download: (name, bytes) => downloads.push({ name, bytes }),
    now: () => NOW,
    fetchDemoFile: async () => new Uint8Array(),
    settings: {
      get: (key) => settings.get(key) ?? null,
      set: (key, value) => {
        settings.set(key, value);
      },
    },
  };
}

/** A session with one settled disagreement, ready to be finalized. */
function sessionWith(choice: DisagreementChoice): SessionState {
  return {
    ...EMPTY_SESSION,
    workbookId: "wb-1",
    store: fakeStore(),
    plan: PLAN,
    sides: { origin: "v1", a: "v2", b: "v3" },
    sheetNames: new Map([[1, "Budget"]]),
    choices: { "1:B5": choice },
  };
}

describe("finalizeCombine", () => {
  it("keeps the decisions and the report of the finished combine", async () => {
    const downloads: { name: string; bytes: Uint8Array }[] = [];
    const host = fakeHost(downloads);
    const registry = createRegistry(host);
    registry.add({ id: "wb-1", name: "budget-2026.xlsx", createdAt: NOW });
    const deps = { engines: fakeEngines(), host };

    const session = await finalizeCombine(deps, registry, sessionWith({ id: "1:B5", pick: "B" }));

    // The decisions survive: the last step shows what the user settled.
    expect(session.choices["1:B5"]).toEqual({ id: "1:B5", pick: "B" });
    // The report of the finished combine is kept, decided line included.
    expect(session.report).toEqual(RESOLVED_REPORT);
    // The file was offered once, under its combined name.
    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.name).toBe("budget-2026-combined.xlsx");
  });

  it("offers the same file again without recording the combine twice", async () => {
    const downloads: { name: string; bytes: Uint8Array }[] = [];
    const host = fakeHost(downloads);
    const registry = createRegistry(host);
    registry.add({ id: "wb-1", name: "budget-2026.xlsx", createdAt: NOW });
    const deps = { engines: fakeEngines(), host };
    const store = fakeStore();
    const first = await finalizeCombine(
      deps,
      registry,
      { ...sessionWith({ id: "1:B5", pick: "B" }), store },
    );
    const second = await finalizeCombine(deps, registry, first);

    expect(downloads).toHaveLength(2);
    expect(downloads[0]?.bytes).toEqual(downloads[1]?.bytes);
    expect(second.combined?.name).toBe("budget-2026-combined.xlsx");
  });
});
