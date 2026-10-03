globalThis.DASHBOARD_CONFIG = Object.freeze({
  id: "daily-mtd",
  title: "Retail Operations OS — Daily Morning / MTD",
  reporting: Object.freeze({
    label: "Achievement through 2 Oct 2026",
    asOf: "2026-10-02",
    elapsedPeriods: 2,
    totalPeriods: 31,
    remainingPeriods: 29,
    periodUnit: "day"
  }),
  governance: Object.freeze({
    source: "October target + validated Daily MTD achievement workbook",
    dataThrough: "2 Oct 2026",
    published: "3 Oct 2026",
    expectedStores: 69
  }),
  benchmarks: Object.freeze({ loanAttachPct: 25, tradeInPct: 20 }),
  dataClassification: "Internal business reporting"
});
