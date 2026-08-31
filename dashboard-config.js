globalThis.DASHBOARD_CONFIG = Object.freeze({
  id: "daily-mtd",
  title: "Retail Operations OS — Daily Morning / MTD",
  reporting: Object.freeze({
    label: "Achievement through 30 Aug 2026",
    asOf: "2026-08-30",
    elapsedPeriods: 30,
    totalPeriods: 31,
    remainingPeriods: 1,
    periodUnit: "day"
  }),
  governance: Object.freeze({
    source: "August target + validated Daily MTD achievement workbook",
    dataThrough: "30 Aug 2026",
    published: "31 Aug 2026",
    expectedStores: 69
  }),
  benchmarks: Object.freeze({ loanAttachPct: 25, tradeInPct: 10 }),
  dataClassification: "Internal business reporting"
});
