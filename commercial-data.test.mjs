import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const dailySource = fs.readFileSync(new URL("./daily-data.js", import.meta.url), "utf8");
const commercialSource = fs.readFileSync(new URL("./commercial-data.js", import.meta.url), "utf8");
const leverSource = fs.readFileSync(new URL("./commercial-levers.js", import.meta.url), "utf8");
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
assert.ok(rows.every(row => row.date === "2026-08-31"));
assert.equal(total("iphoneTradeQty"), 2460);
assert.equal(total("macTradeQty"), 113);
assert.equal(total("iphoneLoanQty"), 3222);
assert.equal(total("overallLoanQty"), 3796);
assert.equal(total("iphoneProtectionQty"), 4893);
assert.equal(total("overallProtectionQty"), 8376);
assert.equal(total("microsoftQty"), 452);
assert.ok(Math.abs(total("lyRevenueSameDate") - 1057805967.03) < 0.001);
assert.ok(Math.abs(total("lyRevenueFullMonth") - 1049293986.04) < 0.001);
assert.ok(Math.abs(actualTotal("revenue") - 2065311072.84) < 0.001);
assert.ok(total("iphoneTradeQty") / actualTotal("iphone") < 1);
assert.ok(total("overallLoanQty") / deviceUnits < 1);
assert.ok(total("overallProtectionQty") / deviceUnits < 1);
assert.equal(rows.filter(row => row.sameDateEligible).length, 68);
assert.equal(rows.flatMap(row => row.qualityFlags || []).length, 0);
assert.deepEqual(
  JSON.parse(JSON.stringify(sandbox.globalThis.PROD_COMMERCIAL_META_2454.excludedTradeInTransactions)).sort(),
  [],
);
assert.equal(sandbox.globalThis.PROD_COMMERCIAL_META_2454.unmappedLoanQtyExcluded, 420);
assert.match(index, /data-page="commercial"/);
assert.match(index, /id="commercial"/);
assert.match(index, /commercial-data\.js\?v=20260902-1/);
assert.match(index, /commercial-levers\.js\?v=20260829-2/);
assert.match(leverSource, /replace\(\/\^Aptronix\\s\+\/i/);
assert.match(index, /trade-in source contains no impossible quantities requiring quarantine/);
assert.doesNotMatch(index, /four impossible trade-in quantities quarantined/);
for (const id of ["tradeTopRows", "tradeBottomRows", "loanTopRows", "loanBottomRows", "licenseTopRows", "licenseBottomRows"]) {
  assert.match(index, new RegExp(`id="${id}"`));
}
assert.match(index, /Top 5 &amp; Bottom 5 Commercial Attach/);
assert.match(index, /Available-period YoY Growth/);
assert.match(index, /source-supplied 1–23 Aug 2025/);
assert.match(leverSource, /function renderRankings\(rows\)/);
assert.match(leverSource, /renderYoy\(rows\);renderRankings\(rows\);renderTable\(rows\)/);

const ranked = metric => rows.map(row => {
  const key = Object.keys(commercial).find(key => commercial[key] === row);
  const actual = actuals[key];
  const devices = ["iphone", "mac", "ipad", "watch", "airpods"].reduce((sum, field) => sum + Number(actual[field] || 0), 0);
  const [qty, base] = metric === "trade"
    ? [Number(row.iphoneTradeQty || 0), Number(actual.iphone || 0)]
    : metric === "loan"
      ? [Number(row.overallLoanQty || 0), devices]
      : [Number(row.overallProtectionQty || 0), devices];
  return { store: row.store, qty, base, rate: base > 0 ? qty / base * 100 : null };
}).filter(row => row.rate != null);
const top = metric => ranked(metric).sort((a, b) => b.rate - a.rate || b.qty - a.qty || a.store.localeCompare(b.store)).slice(0, 5).map(row => row.store);
const bottom = metric => ranked(metric).sort((a, b) => a.rate - b.rate || b.base - a.base || a.store.localeCompare(b.store)).slice(0, 5).map(row => row.store);
assert.deepEqual(top("trade"), ["Aptronix Inorbit Mall", "Aptronix Gachibowli", "Aptronix Borivali", "Aptronix Ambience VK", "Aptronix Promenade"]);
assert.deepEqual(bottom("trade"), ["Aptronix Khammam", "Aptronix MBD", "Aptronix Kamla Nagar", "Aptronix Nikol", "Aptronix Vizianagaram"]);
assert.deepEqual(top("loan"), ["Aptronix Siddipet", "Aptronix Bhimavaram", "Aptronix Hanamkonda", "Aptronix Khammam", "Aptronix karimnagar"]);
assert.deepEqual(bottom("loan"), ["Aptronix GVK One", "Aptronix Ambience GGN", "Aptronix Promenade", "Aptronix Jubilee Hills", "Aptronix Galleria"]);
assert.deepEqual(top("license"), ["Aptronix VR CHENNAI", "Aptronix Sunview", "Aptronix MBD", "Aptronix Kamla Nagar", "Aptronix Ambattur"]);
assert.deepEqual(bottom("license"), ["Aptronix Naroda", "Aptronix Bodakdev", "Aptronix Maninagar", "Aptronix Vijay Cross Road", "Aptronix GVK One"]);

console.log("Commercial levers validated: 69 stores, clean attachment rates, rankings, and labelled prior-period coverage");
