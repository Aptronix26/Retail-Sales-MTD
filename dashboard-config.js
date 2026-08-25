globalThis.DASHBOARD_CONFIG = Object.freeze({
  id: "daily-mtd",
  title: "Retail Operations OS — Daily Morning / MTD",
  reporting: Object.freeze({
    label: "Achievement through 24 Aug 2026",
    asOf: "2026-08-24",
    elapsedPeriods: 24,
    totalPeriods: 31,
    remainingPeriods: 7,
    periodUnit: "day"
  }),
  governance: Object.freeze({
    source: "August target + validated Daily MTD achievement workbook",
    dataThrough: "24 Aug 2026",
    published: "25 Aug 2026",
    expectedStores: 69
  }),
  benchmarks: Object.freeze({ loanAttachPct: 25, tradeInPct: 10 }),
  dataClassification: "Internal business reporting"
});
