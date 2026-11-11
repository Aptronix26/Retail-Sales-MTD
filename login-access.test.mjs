import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const extract=pattern=>JSON.parse(html.match(pattern)?.[1]||'null');
const stores=extract(/window\.STORE_MAP=(\[.*?\]);/s);
const employees=extract(/window\.PROD_EMPLOYEE_ACCESS_2454=(\[.*?\]);/s);
const context={window:{}};
vm.createContext(context);
for(const file of ['weekly-targets.js','sales-achievements.js','product-sales-data.js'])vm.runInContext(fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8'),context);
const targets=context.window.WEEKLY_STAFF_TARGETS;
const sales=context.window.WEEKLY_STAFF_ACHIEVEMENTS;
const lobs=Array.from(targets.lobOrder);
const enterpriseRoles=new Set(['RM','Admin / HO','CEO','Business Head']);
const baseIds=new Set(employees.map(row=>String(row.employeeId)));
const staffAccounts=[];
for(const row of sales.rows)for(const executive of row.executives||[]){
  const id=String(executive.code);
  if(baseIds.has(id)||staffAccounts.some(account=>account.employeeId===id))continue;
  staffAccounts.push({employeeId:id,firstName:String(executive.name||row.staff).replace(/\(\d+\)/g,'').trim().split(/\s+/)[0],fullName:executive.name,role:'Staff',scopeUser:row.store,targetStaffName:row.staff});
}
const allAccounts=[...employees,...staffAccounts,
  {employeeId:'KN',firstName:'KN',fullName:'Business Head',role:'Business Head',scopeUser:'Business Head'},
  {employeeId:'MS',firstName:'MS',fullName:'CEO',role:'CEO',scopeUser:'CEO'}
];

function accountStores(account){
  if(enterpriseRoles.has(account.role))return stores;
  if(account.role==='ARM')return stores.filter(row=>row.arm===account.scopeUser);
  if(['Store Manager','Staff'].includes(account.role))return stores.filter(row=>row.store===account.scopeUser);
  return [];
}
function productActual(scope,week='W7'){
  const allowed=new Set(scope.map(row=>row.store));
  const out=Object.fromEntries(lobs.map(lob=>[lob,0]));
  for(const row of sales.productByStoreWeek||[])if(row.week===week&&allowed.has(row.store)&&lobs.includes(row.lob))out[row.lob]+=Number(row.units||0);
  return out;
}
function commercialActual(scope,week='W7'){
  const allowed=new Set(scope.map(row=>row.store));
  const out=Object.fromEntries(lobs.map(lob=>[lob,0]));
  for(const row of sales.commercialByStoreWeek||[])if(row.week===week&&allowed.has(row.store))for(const lob of lobs)out[lob]+=Number(row.lobUnits?.[lob]||0);
  return out;
}

test('every employee and sales staff ID maps to a valid non-empty login scope',()=>{
  assert.equal(stores.length,69);
  assert.equal(employees.length,158);
  assert.equal(staffAccounts.length,242);
  assert.equal(allAccounts.length,402);
  assert.equal(new Set(allAccounts.map(row=>String(row.employeeId))).size,allAccounts.length);
  for(const account of allAccounts){
    assert.ok(account.employeeId&&account.firstName,`Missing credentials for ${account.fullName}`);
    const scope=accountStores(account);
    assert.ok(scope.length>0,`${account.employeeId} ${account.fullName} has no mapped stores`);
    if(['Store Manager','Staff'].includes(account.role))assert.equal(scope.length,1,`${account.employeeId} must map to one store`);
    if(account.role==='ARM')assert.ok(scope.every(row=>row.arm===account.scopeUser),`${account.employeeId} crosses ARM scope`);
    if(enterpriseRoles.has(account.role))assert.equal(scope.length,69,`${account.employeeId} must have enterprise scope`);
  }
});

test('every login scope reconciles W7 LOB actuals across product and commercial sources',()=>{
  for(const account of allAccounts)assert.deepEqual(productActual(accountStores(account)),commercialActual(accountStores(account)),`${account.employeeId} ${account.fullName} has inconsistent W7 totals`);
  assert.deepEqual(productActual(stores),{iPhone:1037,Mac:243,iPad:191,Watch:119,AirPods:240});
});

test('every hierarchy store exists in targets, commercial and product actuals',()=>{
  const targetStores=new Set(targets.arms.flatMap(arm=>arm.stores.map(store=>store.store)));
  const commercialStores=new Set((sales.commercialByStoreWeek||[]).map(row=>row.store));
  const productStores=new Set((sales.productByStoreWeek||[]).map(row=>row.store));
  for(const row of stores){
    assert.ok(targetStores.has(row.store),`${row.store} missing weekly targets`);
    assert.ok(commercialStores.has(row.store),`${row.store} missing commercial actuals`);
    assert.ok(productStores.has(row.store),`${row.store} missing product actuals`);
  }
});

test('business navigation is forced visible and stale monthly input grid is hidden',()=>{
  assert.match(html,/\['dashboard','commercial','product','input','mission','trajectory','gpt','rhythm'\]\.includes\(item\.dataset\.page\)/);
  const css=fs.readFileSync(new URL('./weekly-targets.css',import.meta.url),'utf8');
  assert.match(css,/#input>\.legacyInputLabel,#input>\.alignedInputTable,#input>\.inputHelp\{display:none!important\}/);
});
