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
  assert.match(html,/traffic-intelligence\.js\?v=20261127-5/);
  assert.match(html,/traffic-intelligence\.css\?v=20261127-3/);
  assert.match(ui,/if\(current\.role==='ARM'\)return ROWS\.filter\(row=>row\.arm===current\.user\)/);
  assert.match(ui,/\['Store Manager','Staff'\]\.includes\(current\.role\)/);
  assert.match(ui,/same \$\{days\} days vs/);
  assert.match(ui,/Store revenue/);
  assert.match(ui,/daily run rate vs/);
  assert.match(ui,/of \$\{locationRows\(rows\)\.length\} locations shown/);
  assert.match(ui,/locationGrid\.style\.maxHeight='none'/);
  assert.match(ui,/\['build','navigate'\]\.includes\(changed\)/);
});
