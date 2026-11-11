import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context={window:{}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('./weekly-targets.js',import.meta.url),'utf8'),context);
vm.runInContext(fs.readFileSync(new URL('./sales-achievements.js',import.meta.url),'utf8'),context);
vm.runInContext(fs.readFileSync(new URL('./product-sales-data.js',import.meta.url),'utf8'),context);
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
  assert.equal(actual,1792);
});

test('weekly commercial source covers all stores and uses invoice fields',()=>{
  const rows=sales.commercialByStoreWeek.filter(row=>row.week==='W7');
  assert.equal(rows.length,69);
  assert.equal(new Set(rows.map(row=>row.store)).size,69);
  const total=field=>rows.reduce((sum,row)=>sum+Number(row[field]||0),0);
  assert.equal(total('coreUnits'),1830);
  assert.equal(total('tradeInUnits'),136);
  assert.equal(total('financeUnits'),609);
  assert.equal(total('licenseUnits'),867);
  assert.equal(Math.round(total('netRevenue')),237986169);
  for(const lob of lobs){
    const lobUnits=rows.reduce((sum,row)=>sum+Number(row.lobUnits?.[lob]||0),0);
    assert.equal(lobUnits,Number(sales.sourceCoreByWeek.W7[lob]||0));
  }
  assert.equal(rows.reduce((sum,row)=>sum+lobs.reduce((lobSum,lob)=>lobSum+Number(row.lobUnits?.[lob]||0),0),0),total('coreUnits'));
  assert.equal(rows.reduce((sum,row)=>sum+lobs.reduce((lobSum,lob)=>lobSum+Number(row.licenseByLob?.[lob]||0),0),0),total('licenseUnits'));
  assert.ok(rows.every(row=>Number(row.tradeInUnits)<=Number(row.coreUnits)));
  assert.ok(rows.every(row=>Number(row.financeUnits)<=Number(row.coreUnits)));
  assert.ok(rows.every(row=>Number(row.licenseUnits)>=0));
  const productRows=sales.productByStoreWeek.filter(row=>row.week==='W7');
  assert.equal(productRows.reduce((sum,row)=>sum+Number(row.units||0),0),1830);
  for(const lob of lobs){
    assert.equal(productRows.filter(row=>row.lob===lob).reduce((sum,row)=>sum+Number(row.units||0),0),Number(sales.sourceCoreByWeek.W7[lob]||0));
  }
  const galleriaIphone17=sales.productByStoreWeek.find(row=>row.week==='W1'&&row.store==='Aptronix Galleria'&&row.lob==='iPhone'&&row.subLob==='IPHONE 17');
  assert.equal(galleriaIphone17?.units,10);
  assert.equal(galleriaIphone17?.location,'GURUGRAM');
  const qtdIphone= sales.productByStoreWeek.filter(row=>row.lob==='iPhone');
  const orgIphone17Mix=qtdIphone.filter(row=>row.subLob==='IPHONE 17').reduce((sum,row)=>sum+Number(row.units||0),0)/qtdIphone.reduce((sum,row)=>sum+Number(row.units||0),0)*100;
  const stores=new Set(qtdIphone.map(row=>row.store));
  const storeMixes=[...stores].map(store=>{
    const rows=qtdIphone.filter(row=>row.store===store);const base=rows.reduce((sum,row)=>sum+Number(row.units||0),0);
    return base?rows.filter(row=>row.subLob==='IPHONE 17').reduce((sum,row)=>sum+Number(row.units||0),0)/base*100:0;
  });
  assert.ok(storeMixes.some(value=>value>=orgIphone17Mix));
  assert.ok(storeMixes.some(value=>value<orgIphone17Mix));
});

test('weekly UI labels loan and trade-in attach and excludes footfall calculations',()=>{
  const source=fs.readFileSync(new URL('./weekly-operating-model.js',import.meta.url),'utf8');
  assert.match(source,/Loan attach by LOB/i);
  assert.match(source,/Trade-in attach by LOB/i);
  assert.match(source,/iPhone AppleCare \/ license attach/i);
  assert.match(source,/Overall AppleCare \/ license attach/i);
  assert.match(source,/Weekly Unit Gap by LOB/);
  assert.match(source,/Week-End Target vs Achievement/);
  assert.match(source,/commercialRankIndex/);
  assert.match(source,/<em> units<\/em>/);
  assert.doesNotMatch(source,/footfall\s*\//i);
  const targetUi=fs.readFileSync(new URL('./weekly-targets-ui.js',import.meta.url),'utf8');
  assert.doesNotMatch(targetUi,/overallHead|targetTotal|actualTotal/);
  const productUi=fs.readFileSync(new URL('./product-intelligence.js',import.meta.url),'utf8');
  assert.match(productUi,/Sub-LOB \/ model/);
  assert.match(productUi,/productLocation/);
  assert.match(productUi,/productArm/);
  assert.match(productUi,/QTD ·/);
  assert.match(productUi,/const weekLabel=week/);
  assert.match(productUi,/weeks\.includes\(priorWeek\)/);
  assert.match(productUi,/ARM sales by week/);
  assert.match(productUi,/contributionScopeLabel/);
  assert.doesNotMatch(productUi,/unitShare/);
  assert.match(productUi,/absolute number of selected product units/);
  assert.match(productUi,/absolute units sold/);
  assert.match(productUi,/productContributionMatrix/);
  assert.match(productUi,/productContributionScope/);
  assert.doesNotMatch(productUi,/Revenue %|iPhone %|data-contribution-metric/);
  assert.match(productUi,/organisationMixBenchmark/);
  assert.match(productUi,/Good performance/);
  assert.match(productUi,/Needs improvement/);
  assert.match(productUi,/Relative mix benchmark, not a sales target/);
  assert.doesNotMatch(productUi,/productContributionRows/);
  assert.doesNotMatch(productUi,/rows\.slice\(0,10\)/);
  assert.match(productUi,/priorWeek=weeks\[weeks\.length-2\]/);
  assert.match(productUi,/Change vs last week/);
  const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
  assert.match(html,/data-page="product"/);
  assert.match(html,/BUSINESS_PAGES=\[[^\]]*'product'/);
});
