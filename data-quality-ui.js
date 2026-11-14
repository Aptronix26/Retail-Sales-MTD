(function(){
  'use strict';

  const SALES=window.WEEKLY_STAFF_ACHIEVEMENTS;
  const TARGETS=window.WEEKLY_STAFF_TARGETS;
  if(!SALES||!TARGETS)return;

  const LOBS=Array.from(TARGETS.lobOrder||['iPhone','Mac','iPad','Watch','AirPods']);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const num=value=>Number(value)||0;
  const fmt=value=>Math.round(num(value)).toLocaleString('en-IN');
  const pct=value=>`${num(value).toFixed(1)}%`;
  const sumByWeek=source=>Object.values(source||{}).reduce((total,week)=>total+LOBS.reduce((subtotal,lob)=>subtotal+num(week?.[lob]),0),0);

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
    const coverage=sourceTotal?matchedTotal/sourceTotal*100:100;
    const unresolvedUnits=rows.reduce((total,row)=>total+num(row.units),0);
    const body=document.getElementById('dqRows');
    const summary=document.getElementById('dqSummary');
    const exportButton=document.getElementById('dqExport');
    if(summary)summary.innerHTML=`
      <div class="dqMetric dqMetric--good"><span>Network store coverage</span><b>${allowed.size?`${allowed.size} / ${allowed.size}`:'—'}</b><small>${allowed.size?'All permitted stores represented':'Sign in to view your permitted scope'}</small></div>
      <div class="dqMetric ${coverage>=95?'dqMetric--good':'dqMetric--risk'}"><span>Staff attribution</span><b>${pct(coverage)}</b><small>${fmt(matchedTotal)} of ${fmt(sourceTotal)} core units</small></div>
      <div class="dqMetric ${rows.length?'dqMetric--review':'dqMetric--good'}"><span>Assignments to review</span><b>${fmt(rows.length)}</b><small>${fmt(unresolvedUnits)} units in the current view</small></div>
      <div class="dqMetric dqMetric--good"><span>Publish gate</span><b>${coverage>=95?'Passed':'Blocked'}</b><small>Minimum staff attribution: 95%</small></div>`;
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
      <div class="dqHead"><div><span class="eyebrow">DATA QUALITY &amp; ATTRIBUTION</span><h3>Sales assignment review</h3><p>Network totals retain every valid invoice. This queue identifies sales that cannot yet be attributed to a target staff member.</p></div><button id="dqExport" class="dqExport" type="button">Download review CSV</button></div>
      <div class="dqSummary" id="dqSummary"></div>
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

  window.DATA_QUALITY_UI={render,scopedRows,currentRows};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
