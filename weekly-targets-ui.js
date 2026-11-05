(function(){
  const DATA=window.WEEKLY_STAFF_TARGETS;
  const SALES=window.WEEKLY_STAFF_ACHIEVEMENTS;
  if(!DATA)return;
  const LOBS=DATA.lobOrder||['iPhone','Mac','iPad','Watch','AirPods'];
  const esc=(value)=>String(value??'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number=(value)=>Number.isFinite(Number(value))?Number(value):0;
  const display=(value)=>value===null||value===undefined||value===''?'—':Number(value).toLocaleString('en-IN');
  const pct=(actual,target)=>target>0?`${Math.round(actual/target*100)}%`:'—';
  const key=(arm,store,staff)=>`${arm}\u241f${store}\u241f${staff}`;
  const achievementMap=new Map((SALES?.rows||[]).map(row=>[key(row.arm,row.store,row.staff),row]));
  const asOf=SALES?.asOfDate?new Date(`${SALES.asOfDate}T00:00:00`):null;
  const dateLabel=(iso)=>iso?new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):'—';
  const rangeFor=(week)=>SALES?.weekRanges?.[week];
  const weekLabel=(week)=>{
    const range=rangeFor(week);
    return range?`${week.replace('W','Week ')} · ${dateLabel(range.start)}–${dateLabel(range.end)}`:`${week.replace('W','Week ')} · Sun–Sat`;
  };
  const weekHasActual=(week)=>{
    const range=rangeFor(week);
    return Boolean(asOf&&range&&asOf>=new Date(`${range.start}T00:00:00`));
  };
  const flatten=()=>DATA.arms.flatMap(arm=>arm.stores.flatMap(store=>store.staff.map(staff=>({
    arm:arm.arm,store:store.store,staff:staff.name,targets:staff.targets,
    achievements:achievementMap.get(key(arm.arm,store.store,staff.name))?.achievements||null
  }))));
  const ROWS=flatten();

  function option(value,label){return `<option value="${esc(value)}">${esc(label??value)}</option>`;}
  function selectedRows(){
    const arm=document.getElementById('weeklyTargetArm')?.value||'All';
    const store=document.getElementById('weeklyTargetStore')?.value||'All';
    const staff=document.getElementById('weeklyTargetStaff')?.value||'All';
    return ROWS.filter(row=>(arm==='All'||row.arm===arm)&&(store==='All'||row.store===store)&&(staff==='All'||row.staff===staff));
  }
  function populateStores(){
    const arm=document.getElementById('weeklyTargetArm').value;
    const stores=[...new Set(ROWS.filter(row=>arm==='All'||row.arm===arm).map(row=>row.store))].sort();
    const select=document.getElementById('weeklyTargetStore');
    const prior=select.value;
    select.innerHTML=option('All','All stores')+stores.map(store=>option(store,store.replace(/^Aptronix\s+/i,''))).join('');
    select.value=stores.includes(prior)?prior:'All';
    populateStaff();
  }
  function populateStaff(){
    const arm=document.getElementById('weeklyTargetArm').value;
    const store=document.getElementById('weeklyTargetStore').value;
    const staff=[...new Set(ROWS.filter(row=>(arm==='All'||row.arm===arm)&&(store==='All'||row.store===store)).map(row=>row.staff))].sort((a,b)=>a.localeCompare(b));
    const select=document.getElementById('weeklyTargetStaff');
    const prior=select.value;
    select.innerHTML=option('All','All staff')+staff.map(name=>option(name)).join('');
    select.value=staff.includes(prior)?prior:'All';
    render();
  }
  function pairCell(target,actual,hasActual){
    return `<div class="weeklyTargetPair">
      <div class="weeklyTargetValues">
        <span><small>Target</small><b>${display(target)}</b></span>
        <span><small>Achieved</small><b>${hasActual?display(actual):'—'}</b></span>
      </div>
      <span class="weeklyTargetRate ${hasActual?'':'pending'}">${hasActual?pct(actual,number(target)):'Pending'}</span>
    </div>`;
  }
  function render(){
    const rows=selectedRows();
    const week=document.getElementById('weeklyTargetWeek').value;
    const hasActual=weekHasActual(week);
    const targets=Object.fromEntries(LOBS.map(lob=>[lob,rows.reduce((sum,row)=>sum+number(row.targets?.[week]?.[lob]),0)]));
    const actuals=Object.fromEntries(LOBS.map(lob=>[lob,rows.reduce((sum,row)=>sum+number(row.achievements?.[week]?.[lob]),0)]));
    const range=rangeFor(week);
    const periodNote=range?(range.isComplete?`${dateLabel(range.start)}–${dateLabel(range.end)}`:`Through ${dateLabel(SALES.asOfDate)}`):'Sunday–Saturday';
    document.getElementById('weeklyTargetKpis').innerHTML=LOBS.map(lob=>`<div class="weeklyTargetKpi"><span>${esc(lob)}</span><b>${hasActual?`${display(actuals[lob])} / ${display(targets[lob])}`:display(targets[lob])}</b><small>${hasActual?`${pct(actuals[lob],targets[lob])} achieved · ${periodNote}`:`Target · ${periodNote}`}</small></div>`).join('');
    const armCount=new Set(rows.map(row=>row.arm)).size;
    const storeCount=new Set(rows.map(row=>row.store)).size;
    const visibleStores=new Set(rows.map(row=>row.store));
    const sourceReviewCount=(DATA.mappingIssues||[]).filter(issue=>issue.store&&visibleStores.has(issue.store)).length;
    const mappedCount=rows.filter(row=>row.achievements).length;
    const matchedUnits=Object.values(SALES?.matchedCoreByWeek?.[week]||{}).reduce((sum,value)=>sum+number(value),0);
    const sourceUnits=Object.values(SALES?.sourceCoreByWeek?.[week]||{}).reduce((sum,value)=>sum+number(value),0);
    const coverage=sourceUnits?Math.round(matchedUnits/sourceUnits*1000)/10:100;
    const badges=[
      `<span>${armCount} ARM${armCount===1?'':'s'}</span>`,
      `<span>${storeCount} store${storeCount===1?'':'s'}</span>`,
      `<span>${rows.length} staff rows</span>`,
      `<span>${mappedCount} achievement mappings</span>`,
      hasActual?`<span>${coverage}% mapped-unit coverage</span>`:'',
      sourceReviewCount?`<span class="review">${sourceReviewCount} source assignment to review</span>`:''
    ];
    document.getElementById('weeklyTargetMeta').innerHTML=badges.join('');
    const body=document.getElementById('weeklyTargetRows');
    body.innerHTML=rows.length?rows.map(row=>{
      const targetTotal=LOBS.reduce((sum,lob)=>sum+number(row.targets?.[week]?.[lob]),0);
      const actualTotal=LOBS.reduce((sum,lob)=>sum+number(row.achievements?.[week]?.[lob]),0);
      return `<tr><td>${esc(row.arm)}</td><td>${esc(row.store.replace(/^Aptronix\s+/i,''))}</td><td>${esc(row.staff)}</td>${LOBS.map(lob=>`<td class="num">${pairCell(row.targets?.[week]?.[lob],row.achievements?.[week]?.[lob],hasActual)}</td>`).join('')}<td class="num total">${pairCell(targetTotal,actualTotal,hasActual)}</td></tr>`;
    }).join(''):`<tr><td colspan="9" class="weeklyTargetEmpty">No mapped target rows for this selection.</td></tr>`;
  }
  function build(){
    const page=document.getElementById('input');
    if(!page||document.getElementById('weeklyTargetWorkspace'))return;
    const currentWeek=DATA.weeks.find(week=>{
      const range=rangeFor(week);
      return range&&asOf&&asOf>=new Date(`${range.start}T00:00:00`)&&asOf<=new Date(`${range.end}T23:59:59`);
    })||DATA.weeks[0];
    const workspace=document.createElement('div');
    workspace.id='weeklyTargetWorkspace';
    workspace.className='weeklyTargetWorkspace';
    workspace.innerHTML=`
      <div class="weeklyTargetHead"><div><span class="eyebrow">WEEKLY TARGET & ACHIEVEMENT</span><h3>ARM, store and staff performance</h3><p>Weekly targets and net core-unit sales are mapped for iPhone, Mac, iPad, Watch and AirPods. Weeks run Sunday through Saturday.</p></div><span class="weeklyTargetBadge">Sales through ${esc(dateLabel(SALES?.asOfDate))}</span></div>
      <div class="weeklyTargetFilters">
        <div><label for="weeklyTargetArm">ARM</label><select id="weeklyTargetArm"></select></div>
        <div><label for="weeklyTargetStore">Store</label><select id="weeklyTargetStore"></select></div>
        <div><label for="weeklyTargetStaff">Staff member</label><select id="weeklyTargetStaff"></select></div>
        <div><label for="weeklyTargetWeek">Week</label><select id="weeklyTargetWeek">${DATA.weeks.map(week=>option(week,weekLabel(week))).join('')}</select></div>
      </div>
      <div class="weeklyTargetKpis" id="weeklyTargetKpis"></div>
      <div class="weeklyTargetMeta" id="weeklyTargetMeta"></div>
      <div class="weeklyTargetTableWrap"><table class="weeklyTargetTable"><thead><tr><th>ARM</th><th>Store</th><th>Staff</th>${LOBS.map(lob=>`<th class="metricHead"><span>${esc(lob)}</span><small>Target · Achieved</small></th>`).join('')}<th class="metricHead overallHead"><span>Overall</span><small>Target · Achieved</small></th></tr></thead><tbody id="weeklyTargetRows"></tbody></table></div>
      <div class="weeklyTargetFoot">Achievement uses net invoice quantity for POS and Sale Return transactions in the five core LOB categories. Cancelled, held, non-core and non-target-store rows are excluded. ${SALES?`${SALES.sourceRowCount.toLocaleString('en-IN')} source rows were processed; ${(SALES.unmappedExecutives||[]).length} sales identities have core sales but no staff-target row, so their units remain visible in mapping coverage and are not assigned to another person.`:'Achievement source is not loaded.'} Kochi is assigned to Poornesh as confirmed by management.</div>`;
    const heading=page.querySelector('h2');
    const intro=heading?.nextElementSibling;
    (intro||heading)?.insertAdjacentElement('afterend',workspace);
    const armSelect=document.getElementById('weeklyTargetArm');
    armSelect.innerHTML=option('All','All ARMs')+DATA.arms.map(item=>item.arm).sort().map(arm=>option(arm)).join('');
    document.getElementById('weeklyTargetStore').innerHTML=option('All','All stores');
    document.getElementById('weeklyTargetStaff').innerHTML=option('All','All staff');
    document.getElementById('weeklyTargetWeek').value=currentWeek;
    armSelect.addEventListener('change',populateStores);
    document.getElementById('weeklyTargetStore').addEventListener('change',populateStaff);
    document.getElementById('weeklyTargetStaff').addEventListener('change',render);
    document.getElementById('weeklyTargetWeek').addEventListener('change',render);
    populateStores();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
