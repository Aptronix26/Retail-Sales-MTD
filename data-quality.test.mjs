import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context={window:{}};
vm.createContext(context);
for(const file of ['weekly-targets.js','sales-achievements.js','product-sales-data.js'])vm.runInContext(fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8'),context);
const targets=context.window.WEEKLY_STAFF_TARGETS;
const sales=context.window.WEEKLY_STAFF_ACHIEVEMENTS;
const lobs=Array.from(targets.lobOrder);
const sumByWeek=source=>Object.values(source).reduce((total,week)=>total+lobs.reduce((subtotal,lob)=>subtotal+Number(week[lob]||0),0),0);

test('publication gate protects network coverage and staff attribution',()=>{
  const source=sumByWeek(sales.sourceCoreByWeek);
  const matched=sumByWeek(sales.matchedCoreByWeek);
  const unmapped=sumByWeek(sales.unmappedCoreByWeek);
  assert.equal(matched+unmapped,source);
  assert.ok(matched/source>=0.95,`Staff attribution ${(matched/source*100).toFixed(2)}% is below the 95% publish threshold`);
  assert.equal(targets.storeTargets.length,69);
  assert.equal(sales.mappingIssues.length,0);
});

test('unmapped assignment queue reconciles to all unattributed core units',()=>{
  const targetStores=new Set(targets.storeTargets.map(row=>row.store));
  const identities=(sales.unmappedExecutives||[]).filter(row=>Number(row.units)!==0);
  assert.ok(identities.length>0);
  assert.equal(identities.reduce((sum,row)=>sum+Number(row.units||0),0),sumByWeek(sales.unmappedCoreByWeek));
  for(const row of identities){
    assert.ok(targetStores.has(row.store),`${row.store} is outside the target hierarchy`);
    assert.ok(row.executive&&row.executiveCode,`Missing source identity in ${row.store}`);
    assert.notEqual(Number(row.units),0,`Zero-unit identity should not enter the review queue: ${row.executive}`);
    assert.equal(lobs.reduce((sum,lob)=>sum+Number(row.lobUnits?.[lob]||0),0),Number(row.units));
  }
});

test('data-quality review is scope-aware, filterable and exportable',()=>{
  const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
  const source=fs.readFileSync(new URL('./data-quality-ui.js',import.meta.url),'utf8');
  assert.match(html,/data-quality-ui\.css/);
  assert.match(html,/data-quality-ui\.js/);
  assert.match(source,/WEEKLY_TARGET_SCOPE_API/);
  for(const id of ['dqStore','dqLob','dqSearch','dqExport','dqRows'])assert.match(source,new RegExp(id));
  assert.match(source,/unmapped-sales-review-/);
  assert.match(source,/Minimum staff attribution: 95%/);
});
