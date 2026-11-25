import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context={window:{}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('./weekly-targets.js',import.meta.url),'utf8'),context);
vm.runInContext(fs.readFileSync(new URL('./sales-achievements.js',import.meta.url),'utf8'),context);
vm.runInContext(fs.readFileSync(new URL('./product-sales-data.js',import.meta.url),'utf8'),context);
vm.runInContext(fs.readFileSync(new URL('./product-sales-data-2.js',import.meta.url),'utf8'),context);
const data=context.window.WEEKLY_STAFF_TARGETS;
const sales=context.window.WEEKLY_STAFF_ACHIEVEMENTS;

test('weekly staff targets preserve the complete source hierarchy',()=>{
  assert.equal(data.arms.length,15);
  assert.equal(data.arms.reduce((sum,arm)=>sum+arm.stores.length,0),69);
  assert.equal(data.arms.reduce((sum,arm)=>sum+arm.stores.reduce((subtotal,store)=>subtotal+store.staff.length,0),0),313);
  assert.equal(data.storeTargets.length,69);
  assert.deepEqual(Array.from(data.weeks),Array.from({length:13},(_,index)=>`W${index+1}`));
  assert.equal(data.weekStartDay,'Sunday');
  assert.equal(data.weekEndDay,'Saturday');
  assert.deepEqual(Array.from(data.lobOrder),['iPhone','Mac','iPad','Watch','AirPods']);
});

test('weekly target rows retain all five LOB fields and no achievement placeholders',()=>{
  for(const arm of data.arms){
    for(const store of arm.stores){
      for(const staff of store.staff){
        for(const week of data.weeks){
          assert.deepEqual(Object.keys(staff.targets[week]),Array.from(data.lobOrder));
          for(const value of Object.values(staff.targets[week])){
            assert.ok(value===null||typeof value==='number');
          }
        }
      }
    }
  }
});

test('latest W9 location targets cover the complete network',()=>{
  assert.equal(data.targetRefresh.week,'W9');
  assert.equal(data.targetRefresh.sourceCheckedOn,'2026-11-24');
  assert.equal(data.targetRefresh.storeCount,69);
  assert.equal(data.targetRefresh.matchedStaff,310);
  assert.equal(data.targetRefresh.changedStaffRows,92);
  assert.equal(data.targetRefresh.identityExceptions.length,3);
  assert.equal(Object.keys(data.weeklyStoreTargets.W9).length,69);
  const targetStores=JSON.parse(JSON.stringify(data.arms.flatMap(arm=>arm.stores.map(store=>store.store)).sort()));
  assert.deepEqual(JSON.parse(JSON.stringify(Object.keys(data.weeklyStoreTargets.W9).sort())),targetStores);
  const totals=Object.fromEntries(data.lobOrder.map(lob=>[lob,Object.values(data.weeklyStoreTargets.W9).reduce((sum,row)=>sum+Number(row[lob]||0),0)]));
  assert.deepEqual(JSON.parse(JSON.stringify(totals)),{iPhone:2663,Mac:547,iPad:356,Watch:317,AirPods:490});
});

test('management override assigns Kochi to Poornesh without a review alert',()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(data.mappingIssues)),[]);
  const kochi=data.arms.flatMap(arm=>arm.stores.map(store=>({arm:arm.arm,store:store.store}))).filter(row=>row.store==='Aptronix Kochi');
  assert.deepEqual(JSON.parse(JSON.stringify(kochi)),[{arm:'Poornesh',store:'Aptronix Kochi'}]);
});

test('sales achievement rows map one-to-one to all target staff rows',()=>{
  const targetKeys=data.arms.flatMap(arm=>arm.stores.flatMap(store=>store.staff.map(staff=>`${arm.arm}|${store.store}|${staff.name}`))).sort();
  const salesKeys=sales.rows.map(row=>`${row.arm}|${row.store}|${row.staff}`).sort();
  assert.deepEqual(salesKeys,targetKeys);
  assert.equal(sales.rows.filter(row=>row.executives.length===0).length,0);
  assert.equal(sales.mappingIssues.length,0);
});

test('sales dump follows the Sunday-to-Saturday quarter calendar',()=>{
  assert.equal(sales.asOfDate,sales.sourceValidation.dateEnd);
  assert.deepEqual(JSON.parse(JSON.stringify(sales.weekRanges.W1)),{start:'2026-09-27',end:'2026-10-03',isComplete:true});
  assert.deepEqual(JSON.parse(JSON.stringify(sales.weekRanges.W6)),{start:'2026-11-01',end:'2026-11-07',isComplete:true});
  assert.deepEqual(JSON.parse(JSON.stringify(sales.weekRanges.W7)),{start:'2026-11-08',end:'2026-11-14',isComplete:true});
  assert.deepEqual(JSON.parse(JSON.stringify(sales.weekRanges.W8)),{start:'2026-11-15',end:'2026-11-21',isComplete:true});
  assert.deepEqual(JSON.parse(JSON.stringify(sales.weekRanges.W9)),{start:'2026-11-22',end:'2026-11-28',isComplete:false});
});

test('mapped and unmapped core units reconcile to source core units for every week',()=>{
  for(const week of data.weeks){
    for(const lob of data.lobOrder){
      assert.equal(sales.matchedCoreByWeek[week][lob]+sales.unmappedCoreByWeek[week][lob],sales.sourceCoreByWeek[week][lob]);
    }
  }
});

test('weekly workspace renders current-week target and achievement values',()=>{
  const elements=new Map();
  class Element{
    constructor(id=''){this.id=id;this.value='';this._innerHTML='';this.nextElementSibling=null;}
    set innerHTML(value){
      this._innerHTML=value;
      for(const match of value.matchAll(/id="([^"]+)"/g)){
        if(!elements.has(match[1]))elements.set(match[1],new Element(match[1]));
      }
      if(this.id==='weeklyTargetArm'||this.id==='weeklyTargetStore'||this.id==='weeklyTargetStaff')this.value='All';
    }
    get innerHTML(){return this._innerHTML;}
    addEventListener(){}
    insertAdjacentElement(_position,element){if(element.id)elements.set(element.id,element);}
    querySelector(selector){return selector==='h2'?elements.get('inputHeading'):null;}
  }
  const page=new Element('input');
  const heading=new Element('inputHeading');
  const intro=new Element('inputIntro');
  heading.nextElementSibling=intro;
  elements.set('input',page);elements.set('inputHeading',heading);elements.set('inputIntro',intro);
  const uiContext={window:{WEEKLY_STAFF_TARGETS:data,WEEKLY_STAFF_ACHIEVEMENTS:sales},CURRENT_USER:{role:'Admin / HO',user:'Admin / HO',employeeName:'Test Admin',jobTitle:'Growth & Retail Excellence Head'},STORE_MAP:[],document:{
    readyState:'complete',getElementById:(id)=>elements.get(id)||null,createElement:()=>new Element()
  },console,Intl,Date,Map,Set,Object,Number,String,Math};
  vm.createContext(uiContext);
  vm.runInContext(fs.readFileSync(new URL('./weekly-targets-ui.js',import.meta.url),'utf8'),uiContext);
  assert.equal(elements.get('weeklyTargetWeek').value,'W9');
  const currentKpis=elements.get('weeklyTargetKpis').innerHTML;
  for(const lob of data.lobOrder){
    const actual=Number(sales.sourceCoreByWeek.W9[lob]||0).toLocaleString('en-IN');
    const target=Number(Object.values(data.weeklyStoreTargets.W9).reduce((sum,row)=>sum+Number(row[lob]||0),0)).toLocaleString('en-IN');
    assert.match(currentKpis,new RegExp(`${actual} / ${target}`));
  }
  assert.match(elements.get('weeklyTargetRows').innerHTML,/>Target</);
  assert.match(elements.get('weeklyTargetRows').innerHTML,/>Achieved</);

  uiContext.CURRENT_USER={role:'RM',user:'Kunal',employeeName:'Kunal',jobTitle:'Regional Manager'};
  uiContext.window.WEEKLY_TARGET_SCOPE_API.applyAccess();
  assert.match(elements.get('weeklyTargetMeta').innerHTML,/15 ARMs/);

  const scopedArm=data.arms[0];
  uiContext.CURRENT_USER={role:'ARM',user:scopedArm.arm,employeeName:scopedArm.arm,jobTitle:'Area Manager'};
  uiContext.window.WEEKLY_TARGET_SCOPE_API.applyAccess();
  assert.match(elements.get('weeklyTargetMeta').innerHTML,/1 ARM/);
  assert.equal(elements.get('weeklyTargetArm').disabled,true);

  const scopedStore=scopedArm.stores[0];
  uiContext.CURRENT_USER={role:'Store Manager',user:scopedStore.store,employeeName:'Test Manager',jobTitle:'Store Manager'};
  uiContext.window.WEEKLY_TARGET_SCOPE_API.applyAccess();
  assert.match(elements.get('weeklyTargetMeta').innerHTML,/1 store/);
  assert.equal(elements.get('weeklyTargetStore').disabled,true);

  const scopedStaff=scopedStore.staff[0];
  uiContext.CURRENT_USER={role:'Staff',user:scopedStore.store,employeeName:scopedStaff.name,employeeFirstName:scopedStaff.name,jobTitle:'Sales Executive'};
  uiContext.window.WEEKLY_TARGET_SCOPE_API.applyAccess();
  assert.match(elements.get('weeklyTargetMeta').innerHTML,/1 staff row/);
  assert.equal(elements.get('weeklyTargetStaff').value,scopedStaff.name);
  assert.equal(elements.get('weeklyTargetStaff').disabled,true);
});
