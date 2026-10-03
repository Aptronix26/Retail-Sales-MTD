import assert from "node:assert/strict";
import "./dashboard-config.js";

const config = globalThis.DASHBOARD_CONFIG;
assert.equal(typeof config.id, "string");
assert.ok(config.id.length > 0);
assert.equal(typeof config.title, "string");
assert.ok(config.reporting && typeof config.reporting.label === "string");
if (Number.isFinite(config.reporting.totalPeriods)) {
  assert.equal(config.reporting.elapsedPeriods + config.reporting.remainingPeriods, config.reporting.totalPeriods);
}
assert.equal(config.benchmarks.loanAttachPct, 25);
assert.equal(config.benchmarks.tradeInPct, 20);
console.log(`Reporting configuration validated: ${config.reporting.label}`);
