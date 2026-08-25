import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const dailySource = fs.readFileSync(new URL("./daily-data.js", import.meta.url), "utf8");
const commercialSource = fs.readFileSync(new URL("./commercial-data.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const sandbox = { globalThis: {} };
vm.runInNewContext(dailySource, sandbox);
vm.runInNewContext(commercialSource, sandbox);

const actuals = sandbox.globalThis.PROD_ACH_2454;
const commercial = sandbox.globalThis.PROD_COMMERCIAL_2454;
const rows = Object.values(commercial);
const total = key => rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
const actualTotal = key => Object.values(actuals).reduce((sum, row) => sum + Number(row[key] || 0), 0);
const deviceUnits = ["iphone", "mac", "ipad", "watch", "airpods"].reduce((sum, key) => sum + actualTotal(key), 0);

assert.equal(rows.length, 69);
assert.deepEqual(Object.keys(commercial).sort(), Object.keys(actuals).sort());
assert.ok(!Object.values(commercial).some(row => ["Aptronix_PLF_SKC", "Ecom-TL"].includes(row.store)));
assert.ok(rows.every(row => row.date === "2026-08-24"));
assert.equal(total("iphoneTradeQty"), 2175);
assert.equal(total("macTradeQty"), 89);
assert.equal(total("iphoneLoanQty"), 2751);
assert.equal(total("overallLoanQty"), 3245);
assert.equal(total("iphoneProtectionQty"), 4380);
assert.equal(total("overallProtectionQty"), 7277);
assert.equal(total("microsoftQty"), 359);
assert.ok(Math.abs(total("lyRevenueSameDate") - 905215289.11) < 0.001);
assert.ok(Math.abs(total("lyRevenueFullMonth") - 1049293986.04) < 0.001);
assert.ok(Math.abs(actualTotal("revenue") - 1764427335.22) < 0.001);
assert.ok(total("iphoneTradeQty") / actualTotal("iphone") < 1);
assert.ok(total("overallLoanQty") / deviceUnits < 1);
assert.ok(total("overallProtectionQty") / deviceUnits < 1);
assert.equal(rows.filter(row => row.sameDateEligible).length, 66);
assert.equal(rows.flatMap(row => row.qualityFlags || []).length, 4);
assert.deepEqual(
  JSON.parse(JSON.stringify(sandbox.globalThis.PROD_COMMERCIAL_META_2454.excludedTradeInTransactions)).sort(),
  ["BEGTI/2627/4543", "INBTI/2627/6368", "LOGTI/2627/3821", "PMCTI/2627/7855"],
);
assert.equal(sandbox.globalThis.PROD_COMMERCIAL_META_2454.unmappedLoanQtyExcluded, 243);
assert.match(index, /data-page="commercial"/);
assert.match(index, /id="commercial"/);
assert.match(index, /commercial-data\.js\?v=20260825-1/);
assert.match(index, /commercial-levers\.js\?v=20260825-1/);

console.log("Commercial levers validated: 69 stores, clean attachment rates, and same-date YoY coverage");
