import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context={window:{}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('./weekly-targets.js',import.meta.url),'utf8'),context);
vm.runInContext(fs.readFileSync(new URL('./sales-achievements.js',import.meta.url),'utf8'),context);
const targets=context.window.WEEKLY_STAFF_TARGETS;
const sales=context.window.WEEKLY_STAFF_ACHIEVEMENTS;
const lobs=Array.from(targets.lobOrder);

test('current weekly target and staff-attributed achievement reconcile',()=>{
  let target=0;
  let actual=0;
  for(const arm of targets.arms)for(const store of arm.stores)for(const staff of store.staff)for(const lob of lobs){
    target+=Number(staff.targets.W7[lob]||0);
  }
  for(const row of sales.rows)for(const lob of lobs)actual+=Number(row.achievements.W7[lob]||0);
  assert.equal(target,5594);
  assert.equal(actual,1252);
});

test('weekly commercial source covers all stores and uses invoice fields',()=>{
  const rows=sales.commercialByStoreWeek.filter(row=>row.week==='W7');
  assert.equal(rows.length,69);
  assert.equal(new Set(rows.map(row=>row.store)).size,69);
  const total=field=>rows.reduce((sum,row)=>sum+Number(row[field]||0),0);
  assert.equal(total('coreUnits'),1279);
  assert.equal(total('tradeInUnits'),91);
  assert.equal(total('financeUnits'),431);
  assert.equal(total('licenseUnits'),639);
  assert.equal(Math.round(total('netRevenue')),167546549);
  assert.ok(rows.every(row=>Number(row.tradeInUnits)<=Number(row.coreUnits)));
  assert.ok(rows.every(row=>Number(row.financeUnits)<=Number(row.coreUnits)));
  assert.ok(rows.every(row=>Number(row.licenseUnits)>=0));
});

test('weekly UI labels loan and trade-in attach and excludes footfall calculations',()=>{
  const source=fs.readFileSync(new URL('./weekly-operating-model.js',import.meta.url),'utf8');
  assert.match(source,/Loan Attach/);
  assert.match(source,/Trade-in Attach/);
  assert.match(source,/AppleCare \/ License Attach/);
  assert.doesNotMatch(source,/footfall\s*\//i);
});
