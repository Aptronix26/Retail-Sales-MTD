import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("./index.html", import.meta.url), "utf8");

function extractObject(marker) {
  const markerIndex = html.indexOf(marker);
  assert.notEqual(markerIndex, -1, `${marker} must exist`);
  const start = markerIndex + marker.length;
  assert.equal(html[start], "{", `${marker} must be followed by an object`);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(html.slice(start, index + 1));
    }
  }
  assert.fail(`Unclosed object for ${marker}`);
}

const snapshots = [
  extractObject("const EMBEDDED_W1_ACHIEVEMENT="),
  extractObject("const EMBEDDED_W2_ACHIEVEMENT="),
  extractObject("const EMBEDDED_W3_ACHIEVEMENT="),
  extractObject("window.PROD_ACH_2454="),
];
const targets = extractObject("window.PROD_TARGETS_2454=");
const dates = ["2026-08-07", "2026-08-13", "2026-08-21", "2026-08-31"];
const sum = (dataset, field) => Object.values(dataset).reduce((total, row) => total + Number(row[field] || 0), 0);
const revenueTarget = sum(targets, "revenue");
const round1 = value => Math.round(value * 10) / 10;

test("all four permanent weekly snapshots cover the same 69 stores", () => {
  const targetKeys = Object.keys(targets).sort();
  assert.equal(targetKeys.length, 69);
  snapshots.forEach((snapshot, index) => {
    assert.deepEqual(Object.keys(snapshot).sort(), targetKeys, `W${index + 1} store coverage`);
    assert.deepEqual(new Set(Object.values(snapshot).map(row => row.date)), new Set([dates[index]]));
  });
});

test("weekly revenue achievement is complete, monotonic, and correctly calculated", () => {
  const revenues = snapshots.map(snapshot => sum(snapshot, "revenue"));
  const achievement = revenues.map(value => round1(value / revenueTarget * 100));
  assert.deepEqual(achievement, [19.4, 41.5, 65.7, 95.8]);
  for (let index = 1; index < revenues.length; index += 1) {
    assert.ok(revenues[index] > revenues[index - 1], `W${index + 1} must exceed W${index}`);
  }
});

test("exit projection and run rates use the latest snapshot date", () => {
  const w4Achievement = sum(snapshots[3], "revenue") / revenueTarget * 100;
  assert.equal(round1(w4Achievement / 31 * 31), 95.8);
  assert.match(html, /latestActual\.agg\.revenue\/target\.revenue\*100/);
  assert.match(html, /const elapsedDays=latestDate&&!isNaN\(latestDate\)\?latestDate\.getDate\(\):1/);
  assert.match(html, /const totalDays=latestDate&&!isNaN\(latestDate\)\?new Date/);
  assert.doesNotMatch(html, /const elapsedDays=20/);
  assert.doesNotMatch(html, /const snapshotDays=20/);
  assert.doesNotMatch(html, /const daysRemaining=11/);
});

test("W3 baseline is installed after stale browser snapshots are removed", () => {
  assert.match(html, /hist\.push\(\{date:'2026-08-21',data:EMBEDDED_W3_ACHIEVEMENT/);
  assert.match(html, /'2026-08-20','2026-08-21','2026-08-26'/);
});
