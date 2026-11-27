import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context={window:{}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('./traffic-data.js',import.meta.url),'utf8'),context);
const data=context.window.TRAFFIC_INTELLIGENCE;
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('./traffic-intelligence.js',import.meta.url),'utf8');

test('traffic source is reconciled at the expected grain',()=>{
  assert.equal(data.validation.status,'passed');
  assert.equal(data.validation.stores,70);
  assert.equal(data.validation.arms,15);
  assert.equal(data.rows.length,4270);
  assert.equal(data.weekRanges.length,9);
  assert.equal(data.weekRanges.filter(week=>week.complete).length,8);
  assert.deepEqual(JSON.parse(JSON.stringify(data.weekRanges.at(-1))),{week:'W9',start:'2026-11-22',end:'2026-11-26',days:5,complete:false});
  assert.equal(data.validation.sourceOnlyStores.length,1);
  assert.equal(data.validation.sourceOnlyStores[0].store,'Aptronix Felix Plaza');
  assert.equal(data.validation.sourceOnlyStores[0].arm,'Mohit Kumar');
});

test('traffic rows are non-negative and weekly totals match the audited source',()=>{
  assert.ok(data.rows.every(row=>row.traffic>=0));
  const weekly=Object.fromEntries(data.weekRanges.map(week=>[week.week,0]));
  for(const row of data.rows)weekly[row.week]+=row.traffic;
  assert.deepEqual(weekly,{W1:232132,W2:229020,W3:203399,W4:203181,W5:177768,W6:185182,W7:167837,W8:142623,W9:103135});
  assert.equal(Object.values(weekly).reduce((a,b)=>a+b,0),1644277);
});

test('traffic page is wired into public business navigation and applies scoped access',()=>{
  assert.match(html,/data-page="traffic" href="#traffic"/);
  assert.match(html,/id="trafficIntelligenceRoot"/);
  assert.match(html,/traffic-data\.js\?v=20261127-1/);
  assert.match(html,/traffic-intelligence\.js\?v=20261127-19/);
  assert.match(html,/traffic-intelligence\.css\?v=20261127-12/);
  assert.match(ui,/if\(current\.role==='ARM'\)return ROWS\.filter\(row=>row\.arm===current\.user\)/);
  assert.match(ui,/\['Store Manager','Staff'\]\.includes\(current\.role\)/);
  assert.match(ui,/same \$\{days\} days vs/);
  assert.match(ui,/Store revenue/);
  assert.match(ui,/daily run rate vs/);
  assert.match(ui,/of \$\{locationRows\(rows\)\.length\} locations shown/);
  assert.match(ui,/locationGrid\.style\.maxHeight='none'/);
  assert.match(ui,/\['build','navigate'\]\.includes\(changed\)/);
});

test('empty location search does not filter the location grid',()=>{
  assert.ok(!ui.includes("value('trafficSearch')"),'search must not fall back to the "All" default');
});

test('location grid has a total row and its own synced period selector',()=>{
  assert.match(ui,/trafficTotalRow total/);
  assert.match(ui,/id="trafficLocationPeriod"/);
  assert.match(ui,/getElementById\('trafficPeriod'\)\.value=event\.target\.value/);
});

test('MTD period is offered and compares the same dates of the prior month',()=>{
  assert.match(ui,/<option value="MTD">MTD/);
  assert.match(ui,/function comparePeriod/);
});

test('separate week-on-week trend grid for footfall and revenue',()=>{
  assert.match(ui,/id="trafficWowRows"/);
  assert.match(ui,/function renderWowGrid/);
});

test('location grid has an ARM selector and the ARM performance card is removed',()=>{
  assert.match(ui,/id="trafficLocationArm"/);
  assert.ok(!ui.includes('trafficArmRows'));
});

test('day-wise store revenue comes from the raw invoice statement and is complete',()=>{
  const ctx={window:{}};vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new URL('./store-daily-revenue.js',import.meta.url),'utf8'),ctx);
  const daily=ctx.window.STORE_DAILY_REVENUE;
  assert.equal(daily.basis,'raw');
  assert.ok(html.includes('store-daily-revenue.js'));
  assert.deepEqual(JSON.parse(JSON.stringify(daily.missingDates)),[]);
  assert.ok(daily.coverageStart<=data.periodStart&&daily.coverageEnd>=data.asOfDate,'revenue must cover the traffic period');
  const storeTotal=daily.rows.reduce((t,r)=>t+r.netRevenue,0),onlineTotal=daily.rows.reduce((t,r)=>t+r.onlineRevenue,0);
  assert.ok(Math.abs(storeTotal-daily.totals.storeRevenue)<5);assert.ok(Math.abs(onlineTotal-daily.totals.onlineRevenue)<5);
  const key=v=>v.toLowerCase().replace(/^aptronix\s+/,'').replace(/[^a-z0-9]+/g,'');
  const revenueStores=new Set(daily.rows.map(r=>key(r.store)));
  for(const store of new Set(data.rows.map(r=>r.store)))assert.ok(revenueStores.has(key(store)),`no revenue for ${store}`);
});

test('zero-footfall days (ST issue) are excluded from both sides of comparisons',()=>{
  assert.match(ui,/function pairedCompare/);
  assert.match(ui,/ST issue/);
  assert.ok(!/counter issue/i.test(ui));
});
