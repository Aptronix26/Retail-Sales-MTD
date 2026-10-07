globalThis.DASHBOARD_CONFIG = Object.freeze({
  id: "daily-mtd",
  title: "Retail Operations OS — Daily Morning / MTD",
  reporting: Object.freeze({
    label: "Achievement through 4 Oct 2026",
    asOf: "2026-10-04",
    elapsedPeriods: 4,
    totalPeriods: 31,
    remainingPeriods: 27,
    periodUnit: "day"
  }),
  governance: Object.freeze({
    source: "October target + validated Daily MTD achievement workbook",
    dataThrough: "4 Oct 2026",
    published: "5 Oct 2026",
    expectedStores: 69
  }),
  benchmarks: Object.freeze({ loanAttachPct: 25, tradeInPct: 20 }),
  dataClassification: "Internal business reporting"
});
