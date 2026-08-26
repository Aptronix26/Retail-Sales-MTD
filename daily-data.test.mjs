import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("./daily-data.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const sandbox = { globalThis: {} };
vm.runInNewContext(source, sandbox);

const actuals = sandbox.globalThis.PROD_ACH_2454;
const rows = Object.values(actuals);
const metrics = ["revenue", "appleAcc", "nonAcc", "iphone", "mac", "ipad", "watch", "airpods", "license"];
const expectedTotals = {
  revenue: 1799912246.02,
  appleAcc: 37238223.5,
  nonAcc: 42329638.17,
  iphone: 11119,
  mac: 2679,
  ipad: 1287,
  watch: 861,
  airpods: 1689,
  license: 371
};

assert.equal(Object.keys(actuals).length, 69);
assert.ok(rows.every(row => row.date === "2026-08-25"));
assert.ok(rows.every(row => row.store && metrics.every(metric => Number.isFinite(Number(row[metric])))));
assert.ok(!("ecomtl" in actuals));
assert.ok(!("plfskc" in actuals));
for (const metric of metrics) {
  const total = rows.reduce((sum, row) => sum + Number(row[metric]), 0);
  assert.ok(Math.abs(total - expectedTotals[metric]) < 0.001, metric + " total mismatch");
}
assert.equal(sandbox.globalThis.PROD_DATASET_VERSION_2454, "aug2026-2026-08-25-v2458");
assert.equal(sandbox.globalThis.PROD_META_2454.achievementRows, 69);
assert.match(index, /daily-data\.js\?v=20260826-1/);
assert.ok(index.indexOf("daily-data.js?v=20260826-1") < index.indexOf("CLEAN PRODUCTION AUTH + DATA BOOTSTRAP"));
const inlineSource = index.match(/window\.PROD_ACH_2454=(\{.*?\});\nwindow\.PROD_EMPLOYEE_ACCESS_2454=/s)?.[1];
assert.ok(inlineSource, "inline production fallback is required");
const inlineActuals = vm.runInNewContext("(" + inlineSource + ")");
assert.deepEqual(JSON.parse(JSON.stringify(inlineActuals)), JSON.parse(JSON.stringify(actuals)));
const embeddedSource = index.match(/const EMBEDDED_ACHIEVEMENT=(\{.*?\});\n  const EMBEDDED_META=/s)?.[1];
assert.ok(embeddedSource, "legacy renderer embedded data is required");
const embeddedActuals = vm.runInNewContext("(" + embeddedSource + ")");
assert.deepEqual(JSON.parse(JSON.stringify(embeddedActuals)), JSON.parse(JSON.stringify(actuals)));
assert.match(index, /const DATASET_VERSION='aug2026-2026-08-25-v2458'/);

console.log("Daily MTD production data validated: 69 stores through 25 Aug 2026");
