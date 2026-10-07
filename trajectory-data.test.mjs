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

const snapshots = [extractObject("window.PROD_ACH_2454=")];
const targets = extractObject("window.PROD_TARGETS_2454=");
const dates = ["2026-10-04"];
const sum = (dataset, field) => Object.values(dataset).reduce((total, row) => total + Number(row[field] || 0), 0);
const revenueTarget = sum(targets, "revenue");
const round1 = value => Math.round(value * 10) / 10;

test("October starts with one current weekly snapshot covering the same 69 stores", () => {
  const targetKeys = Object.keys(targets).sort();
  assert.equal(targetKeys.length, 69);
  snapshots.forEach((snapshot, index) => {
    assert.deepEqual(Object.keys(snapshot).sort(), targetKeys, `snapshot ${index + 1} store coverage`);
    assert.deepEqual(new Set(Object.values(snapshot).map(row => row.date)), new Set([dates[index]]));
  });
});

test("current weekly revenue achievement is correctly calculated", () => {
  const revenues = snapshots.map(snapshot => sum(snapshot, "revenue"));
  const achievement = revenues.map(value => round1(value / revenueTarget * 100));
  assert.deepEqual(achievement, [8.7]);
});

test("exit projection and run rates use the latest snapshot date", () => {
  const achievement = sum(snapshots[0], "revenue") / revenueTarget * 100;
  assert.equal(round1(achievement / 4 * 31), 67.5);
  assert.match(html, /latestActual\.agg\.revenue\/target\.revenue\*100/);
  assert.match(html, /const elapsedDays=latestDate&&!isNaN\(latestDate\)\?latestDate\.getDate\(\):1/);
  assert.match(html, /const totalDays=latestDate&&!isNaN\(latestDate\)\?new Date/);
  assert.doesNotMatch(html, /const elapsedDays=20/);
  assert.doesNotMatch(html, /const snapshotDays=20/);
  assert.doesNotMatch(html, /const daysRemaining=11/);
});

test("October trajectory does not reuse August weekly snapshots", () => {
  assert.match(html, /Production October MTD Snapshot/);
  assert.doesNotMatch(html, /hist\.push\(\{date:'2026-08-/);
});
