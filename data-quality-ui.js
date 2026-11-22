(function(){
  'use strict';

  const SALES=window.WEEKLY_STAFF_ACHIEVEMENTS;
  const TARGETS=window.WEEKLY_STAFF_TARGETS;
  const STAFF=window.STAFF_MASTER_META||{};
  if(!SALES||!TARGETS)return;

  const LOBS=Array.from(TARGETS.lobOrder||['iPhone','Mac','iPad','Watch','AirPods']);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const num=value=>Number(value)||0;
  const fmt=value=>Math.round(num(value)).toLocaleString('en-IN');
  const pct=value=>`${num(value).toFixed(1)}%`;
  const sumByWeek=source=>Object.values(source||{}).reduce((total,week)=>total+LOBS.reduce((subtotal,lob)=>subtotal+num(week?.[lob]),0),0);

  function sourceHealth(){
    const qa=SALES.sourceValidation||{};
    const checks=[
      {label:'Date continuity',pass:!(qa.missingDates||[]).length,detail:(qa.missingDates||[]).length?`${qa.missingDates.length} missing dates`:`${qa.dateStart||'—'} to ${qa.dateEnd||SALES.asOfDate}`},
      {label:'Source overlap',pass:!(qa.overlapDates||[]).length,detail:(qa.overlapDates||[]).length?`${qa.overlapDates.length} overlapping dates`:'No overlapping daily files'},
      {label:'Exact duplicates',pass:num(qa.exactDuplicateRows)===0,detail:num(qa.deduplicatedRows)?`${fmt(qa.deduplicatedRows)} raw duplicates removed · 0 published`:`${fmt(qa.exactDuplicateRows)} duplicate rows`},
      {label:'Executive identity',pass:num(qa.missingExecutiveRows)===0,detail:`${fmt(qa.missingExecutiveRows)} target-store rows missing identity`},
      {label:'Current-week stores',pass:num(qa.latestWeekStores)===num(qa.targetStores)&&num(qa.targetStores)>0,detail:`${fmt(qa.latestWeekStores)} of ${fmt(qa.targetStores)} stores`},
      {label:'Return reasonableness',pass:num(qa.returnRate)<=15,detail:`${pct(qa.returnRate)} of gross sold units`},
    ];
    return {qa,checks,passed:qa.status==='passed'&&checks.every(check=>check.pass)};
  }

  function loginHealth(){
    const stores=window.STORE_MAP||[];
    const employees=window.PROD_EMPLOYEE_ACCESS_2454||[];
    const enterprise=new Set(['RM','Admin / HO','CEO','Business Head']);
    const baseIds=new Set(employees.map(row=>String(row.employeeId)));
    const supplemental=[];
    for(const row of SALES.rows||[])for(const executive of row.executives||[]){
      const id=String(executive.code||'');
      if(!id||baseIds.has(id)||supplemental.some(item=>item.id===id))continue;
      supplemental.push({id,store:row.store});
    }
    const errors=[];
    const seen=new Set();
    for(const employee of employees){
      const id=String(employee.employeeId||'');
      if(!id||seen.has(id))errors.push(`${id||'Blank ID'} is duplicated or missing`);
      seen.add(id);
      let scope=[];
      if(enterprise.has(employee.role))scope=stores;
      else if(employee.role==='ARM')scope=stores.filter(row=>row.arm===employee.scopeUser);
      else if(['Store Manager','Staff'].includes(employee.role))scope=stores.filter(row=>row.store===employee.scopeUser);
      if(!scope.length)errors.push(`${id} has no valid store scope`);
      if(['Store Manager','Staff'].includes(employee.role)&&scope.length!==1)errors.push(`${id} must map to one store`);
    }
    for(const row of supplemental){if(seen.has(row.id))errors.push(`${row.id} is duplicated`);seen.add(row.id);if(!stores.some(store=>store.store===row.store))errors.push(`${row.id} has no valid store scope`);}
    for(const id of ['KN','MS']){if(seen.has(id))errors.push(`${id} is duplicated`);seen.add(id);}
    const role=typeof CURRENT_USER!=='undefined'&&CURRENT_USER?CURRENT_USER.role:'Not signed in';
    const scopeCount=permittedStores().size;
    return {accounts:seen.size,errors,passed:errors.length===0,role,scopeCount,supplemental:supplemental.length};
  }

  function permittedStores(){
    const api=window.WEEKLY_TARGET_SCOPE_API;
    const rows=api?.accessScope?.().rows||[];
    return new Set(rows.map(row=>row.store));
  }

  function scopedRows(){
    const allowed=permittedStores();
    if(!allowed.size)return [];
    return (SALES.unmappedExecutives||[]).filter(row=>allowed.has(row.store)&&num(row.units)!==0);
  }

  function currentRows(){
    const store=document.getElementById('dqStore')?.value||'All';
    const lob=document.getElementById('dqLob')?.value||'All';
    const search=String(document.getElementById('dqSearch')?.value||'').trim().toLowerCase();
    return scopedRows().filter(row=>
      (store==='All'||row.store===store)&&
      (lob==='All'||num(row.lobUnits?.[lob])!==0)&&
      (!search||`${row.executive} ${row.executiveCode} ${row.store}`.toLowerCase().includes(search))
    ).sort((a,b)=>num(b.units)-num(a.units)||String(a.executive).localeCompare(String(b.executive)));
  }

  function refreshStoreOptions(){
    const select=document.getElementById('dqStore');
    if(!select)return;
    const prior=select.value||'All';
    const stores=[...new Set(scopedRows().map(row=>row.store))].sort((a,b)=>a.localeCompare(b));
    select.innerHTML=`<option value="All">All permitted stores</option>${stores.map(store=>`<option value="${esc(store)}">${esc(store.replace(/^Aptronix\s+/i,''))}</option>`).join('')}`;
    select.value=stores.includes(prior)?prior:'All';
  }

  function render(){
    const section=document.getElementById('dataQualityWorkspace');
    if(!section)return;
    refreshStoreOptions();
    const allowed=permittedStores();
    const rows=currentRows();
    const sourceTotal=sumByWeek(SALES.sourceCoreByWeek);
    const matchedTotal=sumByWeek(SALES.matchedCoreByWeek);
    const quarterCoverage=sourceTotal?matchedTotal/sourceTotal*100:100;
    const currentWeek=Object.entries(SALES.weekRanges||{}).filter(([,period])=>period?.isComplete).sort((a,b)=>String(a[1].end).localeCompare(String(b[1].end))).at(-1)?.[0];
    const currentSource=currentWeek?LOBS.reduce((sum,lob)=>sum+num(SALES.sourceCoreByWeek?.[currentWeek]?.[lob]),0):sourceTotal;
    const currentMatched=currentWeek?LOBS.reduce((sum,lob)=>sum+num(SALES.matchedCoreByWeek?.[currentWeek]?.[lob]),0):matchedTotal;
    const coverage=currentSource?currentMatched/currentSource*100:100;
    const unresolvedUnits=rows.reduce((total,row)=>total+num(row.units),0);
    const source=sourceHealth();
    const access=loginHealth();
    const publishPassed=coverage>=95&&source.passed&&access.passed;
    const body=document.getElementById('dqRows');
    const summary=document.getElementById('dqSummary');
    const exportButton=document.getElementById('dqExport');
    if(summary)summary.innerHTML=`
      <div class="dqMetric dqMetric--good"><span>Network store coverage</span><b>${allowed.size?`${allowed.size} / ${allowed.size}`:'—'}</b><small>${allowed.size?'All permitted stores represented':'Sign in to view your permitted scope'}</small></div>
      <div class="dqMetric ${num(STAFF.pendingEmployees)?'dqMetric--review':'dqMetric--good'}"><span>Staff master mapping</span><b>${STAFF.mappedEmployees?`${fmt(STAFF.mappedEmployees)} / ${fmt(STAFF.sourceRows)}`:'—'}</b><small>${STAFF.pendingEmployees?`${fmt(STAFF.pendingEmployees)} records need hierarchy confirmation`:'All current employees mapped'}</small></div>
      <div class="dqMetric ${coverage>=95?'dqMetric--good':'dqMetric--risk'}"><span>${esc(currentWeek||'Current')} staff attribution</span><b>${pct(coverage)}</b><small>${fmt(currentMatched)} of ${fmt(currentSource)} units · QTD ${pct(quarterCoverage)}</small></div>
      <div class="dqMetric ${rows.length?'dqMetric--review':'dqMetric--good'}"><span>Assignments to review</span><b>${fmt(rows.length)}</b><small>${fmt(unresolvedUnits)} units in the current view</small></div>
      <div class="dqMetric ${source.passed?'dqMetric--good':'dqMetric--risk'}"><span>Upload validation</span><b>${source.passed?'Passed':'Blocked'}</b><small>${source.passed?'Dates, duplicates, identities and returns passed':`${source.qa.criticalIssues?.length||0} critical source issues`}</small></div>
      <div class="dqMetric ${access.passed?'dqMetric--good':'dqMetric--risk'}"><span>Login scope health</span><b>${access.passed?`${fmt(access.accounts)} / ${fmt(access.accounts)}`:'Review'}</b><small>${access.passed?`${access.scopeCount||0} stores in the signed-in scope`:`${access.errors.length} access errors`}</small></div>
      <div class="dqMetric ${publishPassed?'dqMetric--good':'dqMetric--risk'}"><span>Publish gate</span><b>${publishPassed?'Passed':'Blocked'}</b><small>Source QA, login scope and minimum 95% staff attribution</small></div>`;
    const details=document.getElementById('dqAssuranceDetails');
    if(details)details.innerHTML=`<div><h4>Upload checks</h4>${source.checks.map(check=>`<span class="${check.pass?'pass':'fail'}"><b>${check.pass?'Pass':'Block'} · ${esc(check.label)}</b><small>${esc(check.detail)}</small></span>`).join('')}${num(source.qa.blankSourceLobRows)?`<span class="review"><b>Review · Source LOB label</b><small>${fmt(source.qa.blankSourceLobRows)} row uses the validated Category fallback</small></span>`:''}</div><div><h4>Access diagnostic</h4><span class="${access.passed?'pass':'fail'}"><b>${access.passed?'Pass':'Review'} · ${fmt(access.accounts)} authorised accounts</b><small>${esc(access.role)} · ${fmt(access.scopeCount)} permitted stores · ${fmt(access.supplemental)} source-only staff accounts</small></span>${access.errors.slice(0,4).map(error=>`<span class="fail"><b>Access issue</b><small>${esc(error)}</small></span>`).join('')}</div>`;
    if(body)body.innerHTML=rows.length?rows.map(row=>`<tr>
      <td><b>${esc(row.executive||'Unstated')}</b><small>${esc(row.executiveCode||'No code')}</small></td>
      <td>${esc(String(row.store||'').replace(/^Aptronix\s+/i,''))}</td>
      <td class="num"><b>${fmt(row.units)}</b></td>
      ${LOBS.map(lob=>`<td class="num">${fmt(row.lobUnits?.[lob])}</td>`).join('')}
      <td><span class="dqAction">Map employee code to the correct target staff row</span></td>
    </tr>`).join(''):`<tr><td colspan="9" class="dqEmpty">No unmapped sales identities in this view.</td></tr>`;
    if(exportButton)exportButton.disabled=!rows.length;
    section.dataset.filteredRows=String(rows.length);
  }

  function csvEscape(value){
    const text=String(value??'');
    return /[",\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
  }

  function exportCsv(){
    const rows=currentRows();
    if(!rows.length)return;
    const header=['Executive','Executive code','Store','Total units',...LOBS,'Action'];
    const lines=[header,...rows.map(row=>[row.executive,row.executiveCode,row.store,row.units,...LOBS.map(lob=>row.lobUnits?.[lob]||0),'Map employee code to the correct target staff row'])];
    const blob=new Blob([lines.map(line=>line.map(csvEscape).join(',')).join('\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);const link=document.createElement('a');
    link.href=url;link.download=`unmapped-sales-review-${SALES.asOfDate}.csv`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  }

  function build(){
    const page=document.getElementById('input');
    const anchor=document.getElementById('weeklyTargetWorkspace');
    if(!page||!anchor||document.getElementById('dataQualityWorkspace'))return;
    const section=document.createElement('section');
    section.id='dataQualityWorkspace';section.className='dataQualityWorkspace';
    section.innerHTML=`
      <div class="dqHead"><div><span class="eyebrow">UPLOAD, ACCESS &amp; ATTRIBUTION ASSURANCE</span><h3>Publication readiness</h3><p>Every refresh is checked for date continuity, source overlap, exact duplicates, missing identities, store coverage, abnormal returns and login scope before publication.</p></div><button id="dqExport" class="dqExport" type="button">Download review CSV</button></div>
      <div class="dqSummary" id="dqSummary"></div>
      <div class="dqAssuranceDetails" id="dqAssuranceDetails"></div>
      <div class="dqSubhead"><h4>Sales assignment review</h4><p>Unattributed units remain in network, ARM and store totals and are shown here for later mapping.</p></div>
      <div class="dqFilters"><label>Store<select id="dqStore"><option value="All">All permitted stores</option></select></label><label>LOB<select id="dqLob"><option value="All">All LOBs</option>${LOBS.map(lob=>`<option value="${esc(lob)}">${esc(lob)}</option>`).join('')}</select></label><label>Search<input id="dqSearch" type="search" placeholder="Executive name or code"/></label></div>
      <div class="dqTableWrap"><table class="dqTable"><thead><tr><th>Source executive</th><th>Store</th><th class="num">Total</th>${LOBS.map(lob=>`<th class="num">${esc(lob)}</th>`).join('')}<th>Required mapping action</th></tr></thead><tbody id="dqRows"></tbody></table></div>
      <div class="dqNote"><b>Important:</b> unresolved units remain included in network, ARM and store totals. They are excluded only from individual staff attribution until the employee code is mapped.</div>`;
    anchor.insertAdjacentElement('afterend',section);
    for(const id of ['dqStore','dqLob','dqSearch'])document.getElementById(id)?.addEventListener(id==='dqSearch'?'input':'change',render);
    document.getElementById('dqExport')?.addEventListener('click',exportCsv);
    const login=window.retailLogin2454;
    if(typeof login==='function'&&!login.dataQualityWrapped){
      const wrapped=function(){const ok=login.apply(this,arguments);if(ok)setTimeout(render,0);return ok;};wrapped.dataQualityWrapped=true;window.retailLogin2454=wrapped;
    }
    const logout=window.logoutApp;
    if(typeof logout==='function'&&!logout.dataQualityWrapped){
      const wrapped=function(){const result=logout.apply(this,arguments);setTimeout(render,0);return result;};wrapped.dataQualityWrapped=true;window.logoutApp=wrapped;
    }
    render();
  }

  window.DATA_QUALITY_UI={render,scopedRows,currentRows,sourceHealth,loginHealth};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
