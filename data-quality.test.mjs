import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context={window:{}};
vm.createContext(context);
for(const file of ['weekly-targets.js','sales-achievements.js','commercial-executive-data.js','commercial-executive-data-2.js','commercial-executive-data-3.js','commercial-executive-data-4.js','product-sales-data.js','product-sales-data-2.js'])vm.runInContext(fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8'),context);
const targets=context.window.WEEKLY_STAFF_TARGETS;
const sales=context.window.WEEKLY_STAFF_ACHIEVEMENTS;
const lobs=Array.from(targets.lobOrder);
const sumByWeek=source=>Object.values(source).reduce((total,week)=>total+lobs.reduce((subtotal,lob)=>subtotal+Number(week[lob]||0),0),0);

test('publication gate protects network coverage and staff attribution',()=>{
  const source=sumByWeek(sales.sourceCoreByWeek);
  const matched=sumByWeek(sales.matchedCoreByWeek);
  const unmapped=sumByWeek(sales.unmappedCoreByWeek);
  assert.equal(matched+unmapped,source);
  const completed=Object.entries(sales.weekRanges).filter(([,period])=>period.isComplete).sort((a,b)=>a[1].end.localeCompare(b[1].end));
  const currentWeek=completed.at(-1)[0];
  const currentSource=lobs.reduce((total,lob)=>total+Number(sales.sourceCoreByWeek[currentWeek][lob]||0),0);
  const currentMatched=lobs.reduce((total,lob)=>total+Number(sales.matchedCoreByWeek[currentWeek][lob]||0),0);
  assert.ok(currentMatched/currentSource>=0.95,`${currentWeek} staff attribution ${(currentMatched/currentSource*100).toFixed(2)}% is below the 95% publish threshold`);
  assert.equal(targets.storeTargets.length,69);
  assert.equal(sales.mappingIssues.length,0);
  assert.equal(sales.sourceValidation.status,'passed');
  assert.deepEqual(Array.from(sales.sourceValidation.criticalIssues),[]);
});

test('every individual commercial count reconciles to store totals and uses its LOB denominator',()=>{
  const individual=sales.commercialByExecutiveWeek||[];
  assert.ok(individual.length>0);
  const storeTotals=new Map();
  for(const row of individual){
    const key=`${row.store}\u241f${row.week}`;
    if(!storeTotals.has(key))storeTotals.set(key,Object.fromEntries(lobs.map(lob=>[lob,{units:0,trade:0,loan:0,license:0}])));
    for(const lob of lobs){
      const target=storeTotals.get(key)[lob];
      target.units+=Number(row.lobUnits?.[lob]||0);
      target.trade+=Number(row.tradeInByLob?.[lob]||0);
      target.loan+=Number(row.financeByLob?.[lob]||0);
      target.license+=Number(row.licenseByLob?.[lob]||0);
      const base=Number(row.lobUnits?.[lob]||0);
      if(base>0)for(const value of [row.tradeInByLob?.[lob],row.financeByLob?.[lob],row.licenseByLob?.[lob]])assert.ok(Number.isFinite(Number(value)/base*100));
    }
  }
  for(const row of sales.commercialByStoreWeek){
    const totals=storeTotals.get(`${row.store}\u241f${row.week}`);
    assert.ok(totals,`Missing individual records for ${row.store} ${row.week}`);
    for(const lob of lobs)assert.deepEqual(totals[lob],{
      units:Number(row.lobUnits[lob]||0),trade:Number(row.tradeInByLob[lob]||0),
      loan:Number(row.financeByLob[lob]||0),license:Number(row.licenseByLob[lob]||0)
    });
  }
});

test('source upload passes continuity, overlap, duplicate, identity and coverage checks',()=>{
  const qa=sales.sourceValidation;
  assert.equal(qa.dateStart,'2026-09-27');
  assert.equal(qa.dateEnd,sales.asOfDate);
  assert.deepEqual(Array.from(qa.missingDates),[]);
  assert.deepEqual(Array.from(qa.overlapDates),[]);
  assert.equal(qa.exactDuplicateRows,0);
  assert.equal(qa.rawExactDuplicateRows,qa.deduplicatedRows);
  assert.ok(qa.deduplicatedRows>=0);
  assert.equal(qa.processedRows,qa.sourceRows-qa.deduplicatedRows);
  assert.equal(qa.missingExecutiveRows,0);
  assert.equal(qa.latestWeekStores,qa.targetStores);
  assert.ok(qa.sourceRows>0);
  assert.ok(qa.returnRate<15);
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
  assert.match(source,/minimum 95% staff attribution/i);
  assert.match(source,/function sourceHealth/);
  assert.match(source,/function loginHealth/);
  assert.match(source,/Upload validation/);
  assert.match(source,/Login scope health/);
  assert.match(source,/dqAssuranceDetails/);
});
