(function(){
  const DATA=window.TRAFFIC_INTELLIGENCE;
  if(!DATA)return;
  const ROWS=DATA.rows||[];
  const WEEKS=DATA.weekRanges||[];
  const NETWORK_ROLES=['RM','Admin / HO','HO','CEO','Business Head'];
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const num=value=>Number(value)||0;
  const fmt=value=>Math.round(num(value)).toLocaleString('en-IN');
  const pct=value=>Number.isFinite(value)?`${value>=0?'+':''}${value.toFixed(1)}%`:'—';
  const clean=value=>String(value||'').replace(/^Aptronix\s+/i,'');
  const dateLabel=value=>new Date(`${value}T00:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
  const user=()=>typeof CURRENT_USER!=='undefined'?CURRENT_USER:null;
  const mapByStore=()=>new Map((window.STORE_MAP||[]).map(row=>[row.store,row]));
  const selected=(actual,wanted)=>wanted==='All'||actual===wanted;
  const value=id=>document.getElementById(id)?.value||'All';
  let currentLocationRows=[];

  function accessibleRows(){
    const current=user();if(!current)return [];
    if(NETWORK_ROLES.includes(current.role))return ROWS;
    if(current.role==='ARM')return ROWS.filter(row=>row.arm===current.user);
    if(['Store Manager','Staff'].includes(current.role))return ROWS.filter(row=>row.store===current.user);
    return [];
  }
  function option(value,label){return `<option value="${esc(value)}">${esc(label??value)}</option>`;}
  function setOptions(id,values,allLabel){
    const node=document.getElementById(id);if(!node)return;
    const prior=node.value;const list=[...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
    node.innerHTML=option('All',allLabel)+list.map(item=>option(item,id==='trafficStore'?clean(item):item)).join('');
    node.value=prior==='All'||list.includes(prior)?prior:'All';
  }
  function datesForWeek(week){return [...new Set(ROWS.filter(row=>row.week===week).map(row=>row.date))].sort();}
  function group(rows,keyFn){const out=new Map();for(const row of rows){const key=keyFn(row);out.set(key,(out.get(key)||0)+num(row.traffic));}return out;}
  function periodRows(){
    const period=value('trafficPeriod'),arm=value('trafficArm'),store=value('trafficStore');
    return accessibleRows().filter(row=>(period==='QTD'||row.week===period)&&selected(row.arm,arm)&&selected(row.store,store));
  }
  function dimensionRows(){
    const arm=value('trafficArm'),store=value('trafficStore');
    return accessibleRows().filter(row=>selected(row.arm,arm)&&selected(row.store,store));
  }
  function compareForWeek(rows,week){
    const index=WEEKS.findIndex(item=>item.week===week);if(index<1)return {current:0,previous:0,change:null,label:'No prior week'};
    const currentInfo=WEEKS[index],previousInfo=WEEKS[index-1];const days=currentInfo.days;
    const currentDates=datesForWeek(week).slice(0,days);const previousDates=datesForWeek(previousInfo.week).slice(0,days);
    const currentSet=new Set(currentDates),previousSet=new Set(previousDates);
    const current=rows.filter(row=>row.week===week&&currentSet.has(row.date)).reduce((total,row)=>total+num(row.traffic),0);
    const previous=rows.filter(row=>row.week===previousInfo.week&&previousSet.has(row.date)).reduce((total,row)=>total+num(row.traffic),0);
    return {current,previous,change:previous?(current-previous)/previous*100:null,label:currentInfo.complete?`vs ${previousInfo.week}`:`same ${days} days vs ${previousInfo.week}`};
  }
  function activeComparison(rows){
    const period=value('trafficPeriod');const week=period==='QTD'?WEEKS[WEEKS.length-1]?.week:period;
    return compareForWeek(rows,week);
  }
  function status(change){return change===null||Math.abs(change)<.05?'neutral':change>0?'positive':'negative';}
  function renderTrend(rows){
    const weekly=WEEKS.map(info=>({info,total:rows.filter(row=>row.week===info.week).reduce((sum,row)=>sum+num(row.traffic),0)}));
    const width=820,height=250,left=45,right=18,top=28,bottom=34,max=Math.max(...weekly.map(item=>item.total),1);
    const x=index=>left+(width-left-right)*(weekly.length===1?.5:index/(weekly.length-1));const y=amount=>top+(height-top-bottom)*(1-amount/max);
    const points=weekly.map((item,index)=>`${x(index)},${y(item.total)}`).join(' ');
    document.getElementById('trafficTrend').innerHTML=`<svg class="trafficTrend" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><defs><linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f86ef" stop-opacity=".28"/><stop offset="1" stop-color="#4f86ef" stop-opacity="0"/></linearGradient></defs>${[0,.25,.5,.75,1].map(level=>`<line class="grid" x1="${left}" x2="${width-right}" y1="${y(max*level)}" y2="${y(max*level)}"/><text x="2" y="${y(max*level)+4}">${fmt(max*level)}</text>`).join('')}<polygon class="area" points="${left},${height-bottom} ${points} ${x(weekly.length-1)},${height-bottom}"/><polyline class="line" points="${points}"/>${weekly.map((item,index)=>`<circle class="point" cx="${x(index)}" cy="${y(item.total)}" r="5"><title>${item.info.week}: ${fmt(item.total)} traffic</title></circle><text class="value" x="${x(index)}" y="${Math.max(15,y(item.total)-10)}" text-anchor="middle">${fmt(item.total)}</text><text x="${x(index)}" y="${height-10}" text-anchor="middle">${item.info.week}${item.info.complete?'':'*'}</text>`).join('')}</svg>`;
    document.getElementById('trafficWeekCards').innerHTML=weekly.map((item,index)=>{const compare=compareForWeek(rows,item.info.week);return `<div class="trafficWeekCard ${item.info.complete?'':'partial'}"><strong>${item.info.week}</strong><b>${fmt(item.total)}</b><span>${dateLabel(item.info.start)}–${dateLabel(item.info.end)} · ${item.info.days} days</span><em class="${status(compare.change)}">${index?pct(compare.change):'Baseline'}</em></div>`;}).join('');
  }
  function renderDayPattern(rows){
    const labels=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];const byDay=labels.map((label,index)=>{const dayRows=rows.filter(row=>new Date(`${row.date}T00:00:00`).getDay()===index);const dates=new Set(dayRows.map(row=>row.date));return {label,value:dates.size?dayRows.reduce((sum,row)=>sum+num(row.traffic),0)/dates.size:0};});
    const max=Math.max(...byDay.map(item=>item.value),1);document.getElementById('trafficDayPattern').innerHTML=byDay.map(item=>`<div class="trafficBarRow"><span>${item.label}</span><div><i style="width:${item.value/max*100}%"></i></div><b>${fmt(item.value)} <small>avg</small></b></div>`).join('');
  }
  function renderArmTable(rows){
    const period=value('trafficPeriod');const currentWeek=period==='QTD'?WEEKS[WEEKS.length-1].week:period;const total=rows.filter(row=>period==='QTD'||row.week===period).reduce((sum,row)=>sum+num(row.traffic),0);
    const arms=[...new Set(rows.map(row=>row.arm))].map(arm=>{const armRows=rows.filter(row=>row.arm===arm);const selectedRows=period==='QTD'?armRows:armRows.filter(row=>row.week===period);const amount=selectedRows.reduce((sum,row)=>sum+num(row.traffic),0);const dates=new Set(selectedRows.map(row=>row.date));const comparison=compareForWeek(armRows,currentWeek);return {arm,amount,average:dates.size?amount/dates.size:0,share:total?amount/total*100:0,...comparison};}).sort((a,b)=>b.amount-a.amount);
    document.getElementById('trafficArmRows').innerHTML=arms.length?arms.map((row,index)=>`<tr><td>${index+1}</td><td><b>${esc(row.arm)}</b></td><td class="num">${fmt(row.amount)}</td><td class="num">${fmt(row.average)}</td><td class="num">${row.share.toFixed(1)}%</td><td class="num ${status(row.change)}">${pct(row.change)}</td><td><span class="trafficPill ${status(row.change)}">${row.change===null?'No comparison':row.change>=0?'Growth':'Decline'}</span></td></tr>`).join(''):`<tr><td colspan="7" class="trafficEmpty">No ARM traffic matches this scope.</td></tr>`;
  }
  function locationRows(rows){
    const period=value('trafficPeriod');const currentWeek=period==='QTD'?WEEKS[WEEKS.length-1].week:period;const map=mapByStore();const total=rows.filter(row=>period==='QTD'||row.week===period).reduce((sum,row)=>sum+num(row.traffic),0);
    return [...new Set(rows.map(row=>row.store))].map(store=>{const storeRows=rows.filter(row=>row.store===store);const selectedRows=period==='QTD'?storeRows:storeRows.filter(row=>row.week===period);const amount=selectedRows.reduce((sum,row)=>sum+num(row.traffic),0);const dates=new Set(selectedRows.map(row=>row.date));const comparison=compareForWeek(storeRows,currentWeek);const first=storeRows[0]||{};return {store,arm:first.arm||'—',city:map.get(store)?.city||'Source-only',sourceOnly:Boolean(first.sourceOnly),amount,average:dates.size?amount/dates.size:0,share:total?amount/total*100:0,...comparison};}).sort((a,b)=>b.amount-a.amount);
  }
  function renderLocations(rows){
    const query=value('trafficSearch').toLowerCase();const filter=value('trafficStatus');
    currentLocationRows=locationRows(rows).filter(row=>(!query||`${row.store} ${row.arm} ${row.city}`.toLowerCase().includes(query))&&(filter==='All'||status(row.change)===filter));
    document.getElementById('trafficLocationCount').textContent=`${currentLocationRows.length} locations shown`;
    document.getElementById('trafficLocationRows').innerHTML=currentLocationRows.length?currentLocationRows.map((row,index)=>`<tr><td>${index+1}</td><td><b>${esc(clean(row.store))}</b>${row.sourceOnly?' <span class="trafficPill source">Source-only</span>':''}</td><td>${esc(row.arm)}</td><td>${esc(row.city)}</td><td class="num">${fmt(row.amount)}</td><td class="num">${fmt(row.average)}</td><td class="num">${row.share.toFixed(1)}%</td><td class="num">${fmt(row.current)}</td><td class="num">${fmt(row.previous)}</td><td class="num ${status(row.change)}">${pct(row.change)}</td><td><span class="trafficPill ${status(row.change)}">${row.change===null?'No comparison':row.change>=0?'Growth':'Decline'}</span></td></tr>`).join(''):`<tr><td colspan="11" class="trafficEmpty">No locations match the filters.</td></tr>`;
  }
  function renderInsights(rows){
    const ranked=locationRows(rows).filter(row=>row.change!==null);const growth=[...ranked].sort((a,b)=>b.change-a.change)[0];const decline=[...ranked].sort((a,b)=>a.change-b.change)[0];const zero=ranked.filter(row=>row.current===0).length;const all=periodRows();const daily=group(all,row=>row.date);const peak=[...daily.entries()].sort((a,b)=>b[1]-a[1])[0];
    document.getElementById('trafficInsights').innerHTML=`<div class="trafficInsight positive"><b>Strongest growth · ${esc(clean(growth?.store||'—'))}</b><span>${growth?pct(growth.change):'No comparable week'} · ${growth?`${fmt(growth.current)} vs ${fmt(growth.previous)}`:'—'} traffic.</span></div><div class="trafficInsight negative"><b>Sharpest decline · ${esc(clean(decline?.store||'—'))}</b><span>${decline?pct(decline.change):'No comparable week'} · ${decline?`${fmt(decline.current)} vs ${fmt(decline.previous)}`:'—'} traffic.</span></div><div class="trafficInsight"><b>Peak day · ${peak?dateLabel(peak[0]):'—'}</b><span>${peak?`${fmt(peak[1])} traffic in the selected scope.`:'No traffic found.'} ${zero?`${zero} locations show zero in the comparison window.`:''}</span></div>`;
  }
  function render(){
    const all=dimensionRows(),rows=periodRows(),dates=new Set(rows.map(row=>row.date)),stores=new Set(rows.map(row=>row.store));const total=rows.reduce((sum,row)=>sum+num(row.traffic),0);const comparison=activeComparison(all);const daily=group(rows,row=>row.date);const peak=[...daily.entries()].sort((a,b)=>b[1]-a[1])[0];const period=value('trafficPeriod');const info=WEEKS.find(item=>item.week===period);const scope=[value('trafficArm')==='All'?'All ARMs':value('trafficArm'),value('trafficStore')==='All'?'All locations':clean(value('trafficStore'))].join(' · ');
    document.getElementById('trafficScope').innerHTML=`<div><b>${esc(scope)}</b> · ${period==='QTD'?`${dateLabel(DATA.periodStart)}–${dateLabel(DATA.periodEnd)}`:`${dateLabel(info.start)}–${dateLabel(info.end)}`} · ${fmt(stores.size)} locations</div>${info&&!info.complete?`<span class="partial">Partial ${period}: ${info.days} days · like-for-like comparison</span>`:''}`;
    document.getElementById('trafficKpis').innerHTML=`<div class="trafficKpi"><span>Total traffic</span><b>${fmt(total)}</b><small>${period==='QTD'?'Quarter-to-date':'Selected week'} footfall</small></div><div class="trafficKpi"><span>Average / day</span><b>${dates.size?fmt(total/dates.size):'—'}</b><small>Total ÷ ${dates.size} calendar days</small></div><div class="trafficKpi"><span>${period==='QTD'?'Latest week':'Weekly'} comparison</span><b class="${status(comparison.change)}">${pct(comparison.change)}</b><small>${esc(comparison.label)} · ${fmt(comparison.current)} vs ${fmt(comparison.previous)}</small></div><div class="trafficKpi"><span>Peak day</span><b>${peak?fmt(peak[1]):'—'}</b><small>${peak?dateLabel(peak[0]):'No data'}</small></div><div class="trafficKpi"><span>Locations reporting</span><b>${fmt(stores.size)}</b><small>${rows.some(row=>row.sourceOnly)?'Includes 1 source-only location':'Mapped dashboard locations'}</small></div><div class="trafficKpi"><span>Average / location / day</span><b>${stores.size&&dates.size?fmt(total/stores.size/dates.size):'—'}</b><small>Comparable network productivity</small></div>`;
    renderTrend(all);renderDayPattern(all);renderArmTable(all);renderLocations(all);renderInsights(all);
  }
  function refreshFilters(changed){
    const rows=accessibleRows();
    if(changed==='arm'){const store=document.getElementById('trafficStore');if(store)store.value='All';}
    setOptions('trafficArm',rows.map(row=>row.arm),'All ARMs');const arm=value('trafficArm');setOptions('trafficStore',rows.filter(row=>selected(row.arm,arm)).map(row=>row.store),'All locations / stores');render();
  }
  function csvCell(value){const text=String(value??'');return /[",\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;}
  function exportLocations(){const header=['Store','ARM','Location group','Traffic','Average/day','Share %','Current comparable','Previous comparable','Change %','Status'];const lines=[header,...currentLocationRows.map(row=>[row.store,row.arm,row.city,row.amount,row.average,row.share,row.current,row.previous,row.change??'',row.change===null?'No comparison':row.change>=0?'Growth':'Decline'])].map(row=>row.map(csvCell).join(','));const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`Traffic_Intelligence_${value('trafficPeriod')}.csv`;link.click();URL.revokeObjectURL(link.href);}
  function build(){
    const root=document.getElementById('trafficIntelligenceRoot');if(!root||root.dataset.ready)return;root.dataset.ready='true';
    root.innerHTML=`<div class="trafficHeader"><div><h2>🚶 Traffic Intelligence</h2><p>Week, location and ARM traffic trends with like-for-like growth and decline signals.</p></div><div class="trafficHeaderActions"><button class="light" id="trafficReset">Reset view</button><button id="trafficExport">Download location report</button></div></div><div class="trafficFilters"><label>Period<select id="trafficPeriod"><option value="QTD">QTD · ${dateLabel(DATA.periodStart)}–${dateLabel(DATA.periodEnd)}</option>${WEEKS.map(info=>option(info.week,`${info.week} · ${dateLabel(info.start)}–${dateLabel(info.end)}${info.complete?'':' · partial'}`)).join('')}</select></label><label>ARM<select id="trafficArm"></select></label><label>Location / store<select id="trafficStore"></select></label><label>Performance status<select id="trafficStatus"><option value="All">All statuses</option><option value="positive">Growth</option><option value="negative">Decline</option><option value="neutral">No change / comparison</option></select></label></div><div class="trafficScope" id="trafficScope"></div><div class="trafficKpis" id="trafficKpis"></div><div class="trafficGrid"><div class="trafficCard"><h3>Weekly traffic trend</h3><p class="trafficNote">W9 is partial through ${dateLabel(DATA.asOfDate)} and is compared with the same first four days of W8.</p><div id="trafficTrend"></div></div><div class="trafficCard"><h3>Day-of-week pattern</h3><p class="trafficNote">Average total traffic for each weekday across the selected hierarchy scope.</p><div class="trafficRankBars" id="trafficDayPattern"></div></div></div><div class="trafficCard" style="margin-bottom:16px"><h3>Week-by-week readout</h3><p class="trafficNote">Absolute traffic, dates and growth versus the preceding comparable period.</p><div class="trafficWeekCards" id="trafficWeekCards"></div></div><div class="trafficCard" style="margin-bottom:16px"><h3>Management signals</h3><p class="trafficNote">Strongest comparable movements in the selected hierarchy scope.</p><div class="trafficInsights" id="trafficInsights"></div></div><div class="trafficCard" style="margin-bottom:16px"><h3>ARM performance</h3><p class="trafficNote">Absolute traffic, daily average, selected-period contribution and latest comparable growth.</p><div class="trafficTableWrap"><table class="trafficTable"><thead><tr><th>#</th><th>ARM</th><th>Traffic</th><th>Avg/day</th><th>Share</th><th>WoW change</th><th>Trend</th></tr></thead><tbody id="trafficArmRows"></tbody></table></div></div><div class="trafficCard"><h3>Location performance</h3><p class="trafficNote">All locations are included; search or filter without limiting the result to a top-10 list.</p><div class="trafficTableTools"><input id="trafficSearch" placeholder="Search location, ARM or group"/><select id="trafficLocationStatus"><option value="All">All trends</option><option value="positive">Growth</option><option value="negative">Decline</option><option value="neutral">No change / comparison</option></select><b id="trafficLocationCount"></b></div><div class="trafficTableWrap"><table class="trafficTable"><thead><tr><th>#</th><th>Location / store</th><th>ARM</th><th>Group</th><th>Traffic</th><th>Avg/day</th><th>Share</th><th>Current comparable</th><th>Previous comparable</th><th>Change</th><th>Trend</th></tr></thead><tbody id="trafficLocationRows"></tbody></table></div></div><div class="trafficMethod"><b>Method:</b> traffic is summed from the source's daily store rows. Average/day = selected traffic ÷ distinct calendar days. Weekly growth compares Sunday–Saturday totals; an incomplete week compares only the same elapsed weekdays of the preceding week. Location share = location traffic ÷ selected-scope traffic. All store, ARM and network totals reconciled to the source workbook. Source: ${esc(DATA.sourceTitle)} · through ${dateLabel(DATA.asOfDate)}.</div>`;
    document.getElementById('trafficPeriod').addEventListener('change',render);document.getElementById('trafficArm').addEventListener('change',()=>refreshFilters('arm'));document.getElementById('trafficStore').addEventListener('change',render);document.getElementById('trafficStatus').addEventListener('change',event=>{document.getElementById('trafficLocationStatus').value=event.target.value;renderLocations(dimensionRows());});document.getElementById('trafficLocationStatus').addEventListener('change',event=>{document.getElementById('trafficStatus').value=event.target.value;renderLocations(dimensionRows());});document.getElementById('trafficSearch').addEventListener('input',()=>renderLocations(dimensionRows()));document.getElementById('trafficReset').addEventListener('click',()=>{['trafficPeriod','trafficArm','trafficStore','trafficStatus','trafficLocationStatus'].forEach(id=>{const node=document.getElementById(id);if(node)node.value=id==='trafficPeriod'?'QTD':'All';});document.getElementById('trafficSearch').value='';refreshFilters('reset');});document.getElementById('trafficExport').addEventListener('click',exportLocations);
    refreshFilters('build');
    const originalNavigate=window.navigateToPage;if(typeof originalNavigate==='function'&&!originalNavigate.trafficWrapped){const wrapped=function(page){const result=originalNavigate.apply(this,arguments);if(page==='traffic')refreshFilters('navigate');return result;};wrapped.trafficWrapped=true;window.navigateToPage=wrapped;}
  }
  window.TRAFFIC_INTELLIGENCE_API={render,refreshFilters,accessibleRows,periodRows};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
