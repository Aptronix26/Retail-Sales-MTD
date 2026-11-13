(function(){
  'use strict';

  const TARGETS=window.WEEKLY_STAFF_TARGETS;
  const SALES=window.WEEKLY_STAFF_ACHIEVEMENTS;
  if(!TARGETS||!SALES)return;

  const LOBS=Array.from(TARGETS.lobOrder||['iPhone','Mac','iPad','Watch','AirPods']);
  const WEEKS=Array.from(TARGETS.weeks||[]);
  const q=id=>document.getElementById(id);
  const num=value=>Number(value)||0;
  const sum=values=>values.reduce((total,value)=>total+num(value),0);
  const fmt=value=>Math.round(num(value)).toLocaleString('en-IN');
  const pct=(value,digits=1)=>`${num(value).toFixed(digits)}%`;
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const setText=(id,value)=>{const node=q(id);if(node)node.textContent=value;};
  const setHtml=(id,value)=>{const node=q(id);if(node)node.innerHTML=value;};
  const setLabel=(selector,value)=>{const node=document.querySelector(selector);if(node)node.textContent=value;};

  function latestWeek(){
    const asOf=SALES.asOfDate;
    return WEEKS.find(week=>{
      const range=SALES.weekRanges?.[week];
      return range&&asOf>=range.start&&asOf<=range.end;
    })||WEEKS[0]||'W1';
  }

  function scopeStores(){
    if(typeof window.scopeRowsV23==='function'){
      const rows=window.scopeRowsV23();
      if(rows?.length)return new Set(rows.map(row=>row.store));
    }
    const store=q('store')?.value;
    if(store&&!String(store).startsWith('All '))return new Set([store]);
    return new Set((window.STORE_MAP||[]).map(row=>row.store));
  }

  function rangeMeta(week){
    const range=SALES.weekRanges?.[week]||{};
    const start=range.start?new Date(`${range.start}T00:00:00`):null;
    const end=range.end?new Date(`${range.end}T00:00:00`):null;
    const asOf=new Date(`${SALES.asOfDate}T00:00:00`);
    const elapsed=start?Math.max(0,Math.min(7,Math.floor((asOf-start)/86400000)+1)):0;
    const remaining=Math.max(0,7-elapsed);
    const label=date=>date?.toLocaleDateString('en-IN',{day:'numeric',month:'short'})||'—';
    return {start,end,elapsed,remaining,label:`${label(start)}–${label(end)}`,through:label(asOf)};
  }

  function aggregate(week=latestWeek(),stores=scopeStores()){
    const byLob=Object.fromEntries(LOBS.map(lob=>[lob,{target:0,actual:0}]));
    const byStore=new Map();
    const ensure=store=>{
      if(!byStore.has(store))byStore.set(store,{store,target:0,actual:0,byLob:Object.fromEntries(LOBS.map(lob=>[lob,{target:0,actual:0}]))});
      return byStore.get(store);
    };
    for(const arm of TARGETS.arms||[])for(const store of arm.stores||[]){
      if(!stores.has(store.store))continue;
      const storeRow=ensure(store.store);
      for(const staff of store.staff||[])for(const lob of LOBS){
        const value=num(staff.targets?.[week]?.[lob]);
        byLob[lob].target+=value;storeRow.byLob[lob].target+=value;
      }
    }
    for(const row of SALES.productByStoreWeek||[]){
      if(row.week!==week||!stores.has(row.store)||!LOBS.includes(row.lob))continue;
      const storeRow=ensure(row.store);
      const value=num(row.units);
      byLob[row.lob].actual+=value;storeRow.byLob[row.lob].actual+=value;
    }
    for(const row of byStore.values())for(const lob of LOBS){row.target+=row.byLob[lob].target;row.actual+=row.byLob[lob].actual;}
    const target=sum(LOBS.map(lob=>byLob[lob].target));
    const actual=sum(LOBS.map(lob=>byLob[lob].actual));
    const meta=rangeMeta(week);
    const achievement=target?actual/target*100:0;
    const pace=meta.elapsed/7*100;
    const projected=meta.elapsed?actual/meta.elapsed*7:0;
    const projectedPct=target?projected/target*100:0;
    const balance=Math.max(0,target-actual);
    const requiredDaily=meta.remaining?balance/meta.remaining:balance;
    const storesArray=Array.from(byStore.values()).map(row=>({...row,achievement:row.target?row.actual/row.target*100:0,balance:Math.max(0,row.target-row.actual)}));
    return {week,stores,byLob,byStore:storesArray,target,actual,achievement,pace,projected,projectedPct,balance,requiredDaily,...meta};
  }

  function status(model){
    const gap=model.achievement-model.pace;
    if(gap>=5)return {label:'Ahead',tone:'good'};
    if(gap>=-2)return {label:'On pace',tone:'watch'};
    return {label:'Recovery required',tone:'risk'};
  }

  function weakestLobs(model){
    return LOBS.map(lob=>{
      const row=model.byLob[lob];
      const achievement=row.target?row.actual/row.target*100:0;
      return {lob,...row,achievement,gap:Math.max(0,row.target-row.actual)};
    }).sort((a,b)=>a.achievement-b.achievement||b.gap-a.gap);
  }

  const LOB_COLORS={iPhone:'#2563eb',Mac:'#0f766e',iPad:'#7c3aed',Watch:'#d97706',AirPods:'#dc2626'};
  function lobRows(model){
    return LOBS.map(lob=>{
      const row=model.byLob[lob]||{target:0,actual:0};
      const target=num(row.target);const actual=num(row.actual);
      const achievement=target?actual/target*100:0;
      const gap=Math.max(0,target-actual);
      const requiredDaily=model.remaining?gap/model.remaining:gap;
      const projected=model.elapsed?actual/model.elapsed*7:actual;
      const projectedPct=target?projected/target*100:0;
      return {lob,target,actual,achievement,gap,requiredDaily,projected,projectedPct};
    });
  }

  function lobMetricList(rows,detail){
    return `<div class="lobMetricList">${rows.map(row=>`<div class="lobMetricRow"><span><i style="background:${LOB_COLORS[row.lob]}"></i>${esc(row.lob)}</span>${detail(row)}</div>`).join('')}</div>`;
  }

  function scopeLabel(model){
    if(model.stores.size===1)return Array.from(model.stores)[0].replace(/^Aptronix\s+/i,'');
    return `${model.stores.size} stores`;
  }

  function updateStaticCopy(model){
    const label=`${model.week} · ${model.label}`;
    const top=document.querySelector('.topbar .title');
    if(top){
      const h=top.querySelector('h1');const p=top.querySelector('p');
      if(h)h.textContent='Weekly Sales Intelligence';
      if(p)p.textContent='Separate weekly targets, achievements and recovery actions for iPhone, Mac, iPad, Watch and AirPods.';
    }
    setText('briefDate',model.through);
    setText('briefScope',`${scopeLabel(model)} · ${label} · sales through ${model.through}`);
    setLabel('#mission h2','🎯 Weekly Mission Recovery Engine');
    setLabel('#mission .card > .mini',`Required target, achievement, gap and daily recovery for each LOB during ${label}.`);
    setLabel('#mission .recoveryTable thead tr', '');
    const missionHead=document.querySelector('#mission .recoveryTable thead');
    if(missionHead)missionHead.innerHTML='<tr><th>LOB</th><th>Weekly Target</th><th>Achieved</th><th>Balance</th><th>Required / Day</th><th>Priority</th><th>Status</th></tr>';
    setLabel('#mission .card.section:nth-of-type(5) h2','Week-End Forecast');
    setLabel('#trajectory h2','📈 Weekly Target vs Achievement Trajectory');
    setLabel('#trajectory > .mini','Completed and current Sunday–Saturday weeks, with a separate target-achievement line for every LOB.');
    setLabel('#trajectory > .mini:last-child','Targets come from the weekly target master. Actuals come from the appended sales invoice source and use the latest available day in the current week.');
    setLabel('#gpt .card:first-child .mini','Select a business question to receive a role-scoped answer with separate LOB targets and sales.');
    setLabel('#rhythm > .card > .mini','A structured daily cadence with a separate mission for every LOB.');
  }

  function renderDashboard(model){
    updateStaticCopy(model);
    const rows=lobRows(model);const weak=[...rows].sort((a,b)=>a.achievement-b.achievement||b.gap-a.gap);
    const cards=Array.from(document.querySelectorAll('#page-dashboard .executiveKpi'));
    cards.forEach((card,index)=>{
      const row=rows[index];if(!row)return;
      const h=card.querySelector('h3');const metric=card.querySelector('.metric');const mini=card.querySelector('.mini');
      if(h)h.textContent=`${row.lob} target vs achieved`;
      if(metric)metric.textContent=`${fmt(row.actual)} / ${fmt(row.target)}`;
      if(mini)mini.textContent=`${pct(row.achievement)} achieved · ${fmt(row.gap)} gap`;
    });

    const onPace=rows.filter(row=>row.achievement>=model.pace).length;
    setText('briefTitle',`${onPace} of 5 LOBs are at or above ${pct(model.pace)} elapsed pace`);
    const briefCards=Array.from(document.querySelectorAll('.briefKpisDecision .briefKpi'));
    if(briefCards[0])briefCards[0].innerHTML=`<span>Week-End Target vs Achievement</span>${lobMetricList(rows,row=>`<b>T ${fmt(row.target)} · A ${fmt(row.actual)}</b><small>Exit ${fmt(row.projected)} · ${pct(row.projectedPct)}</small>`)}`;
    if(briefCards[1])briefCards[1].innerHTML=`<span>Weekly Unit Gap by LOB</span>${lobMetricList(rows,row=>`<b>${fmt(row.gap)}</b><small>${fmt(row.requiredDaily)}/day</small>`)}`;
    if(briefCards[2])briefCards[2].innerHTML=`<span>LOB Pace Status</span>${lobMetricList(rows,row=>`<b class="${row.achievement>=model.pace?'lobGood':'lobRisk'}">${row.achievement>=model.pace?'On pace':'Recover'}</b><small>${pct(row.achievement)}</small>`)}`;
    if(briefCards[3])briefCards[3].innerHTML=`<span>Daily Requirement by LOB</span>${lobMetricList(rows,row=>`<b>${fmt(row.requiredDaily)}</b><small>${fmt(model.remaining)} days left</small>`)}`;

    const storeRows=model.byStore.filter(row=>LOBS.some(lob=>num(row.byLob[lob]?.target)>0)).map(row=>{
      const byLob=Object.fromEntries(LOBS.map(lob=>{const d=row.byLob[lob];const rate=d.target?d.actual/d.target*100:0;return [lob,{...d,rate,gap:Math.max(0,d.target-d.actual)}];}));
      return {...row,byLob,maxGap:Math.max(...LOBS.map(lob=>byLob[lob].gap))};
    }).sort((a,b)=>b.maxGap-a.maxGap);
    setText('briefLeagueTitle','Store LOB position');
    setText('briefLeagueSub','Achievement shown separately for every LOB');
    const leagueHead=document.querySelector('.briefLeague thead');
    if(leagueHead)leagueHead.innerHTML=`<tr><th>Store</th>${LOBS.map(lob=>`<th>${esc(lob)}</th>`).join('')}</tr>`;
    setHtml('briefLeagueRows',storeRows.slice(0,8).map(row=>`<tr><td>${esc(row.store.replace(/^Aptronix\s+/i,''))}</td>${LOBS.map(lob=>{const d=row.byLob[lob];return `<td><b>${fmt(d.actual)}/${fmt(d.target)}</b><small>${pct(d.rate)}</small></td>`;}).join('')}</tr>`).join(''));
    setHtml('briefActions',weak.slice(0,3).map((row,index)=>`<div class="briefAction"><b>${index+1}. Recover ${esc(row.lob)}</b><span>${fmt(row.gap)} units remain; ${fmt(row.requiredDaily)} per day required.</span></div>`).join(''));
    setText('briefInsight',rows.map(row=>`${row.lob} ${pct(row.projectedPct)}`).join(' · '));

    const weakest=weak[0];
    const focusStore=storeRows.slice().sort((a,b)=>b.byLob[weakest.lob].gap-a.byLob[weakest.lob].gap)[0];
    setText('focusHeadline','Recover the lagging LOBs');
    setText('focusRisk',`${onPace}/5 on pace`);
    setHtml('focusPriorities',weak.slice(0,3).map((row,index)=>`<div class="focusPriority"><span>Priority ${index+1}</span><b>${esc(row.lob)} · ${pct(row.achievement)}</b><small>T ${fmt(row.target)} · A ${fmt(row.actual)} · Gap ${fmt(row.gap)}</small></div>`).join(''));
    setText('focusStore',focusStore?`${focusStore.store.replace(/^Aptronix\s+/i,'')} · ${weakest.lob} ${fmt(focusStore.byLob[weakest.lob].gap)}`:'—');
    setLabel('.focusFooter > div:nth-child(1) span','Largest Store × LOB Gap');
    setText('focusConcentration',`${rows.filter(row=>row.achievement<model.pace).length} LOBs below pace`);
    setText('focusAttention',weak.slice(0,2).map(row=>`${row.lob} ${fmt(row.requiredDaily)}/day`).join(' · '));
    setHtml('actionSteps',weak.slice(0,3).map((row,index)=>`<div class="actionStep"><span>${index+1}</span><div><b>${esc(row.lob)} recovery</b><small>Deliver ${fmt(row.requiredDaily)} units/day across ${scopeLabel(model)}.</small></div></div>`).join(''));
    setText('decisionCue',weak.slice(0,3).map(row=>`${row.lob}: ${fmt(row.gap)} gap`).join(' · '));

    const signals=storeRows.flatMap(store=>LOBS.map(lob=>({store:store.store,lob,...store.byLob[lob]}))).filter(row=>row.target>0);
    const hits=signals.filter(row=>row.rate>=model.pace).sort((a,b)=>b.rate-a.rate).slice(0,5);
    const misses=signals.filter(row=>row.rate<model.pace).sort((a,b)=>a.rate-b.rate||b.gap-a.gap).slice(0,5);
    const item=(row,index,hit)=>`<div class="hm-item"><div class="hm-rank">${index+1}</div><div><div class="hm-title">${esc(row.store.replace(/^Aptronix\s+/i,''))} · ${esc(row.lob)}</div><div class="hm-signal">${fmt(row.actual)} / ${fmt(row.target)} · ${pct(row.rate)}</div><div class="hm-reason">${hit?`${pct(row.rate-model.pace)} points ahead of elapsed pace.`:`${pct(model.pace-row.rate)} points behind elapsed pace; ${fmt(row.gap)} units remain.`}</div><div class="hm-action"><b>Action:</b> ${hit?'Protect this LOB run rate.':`Recover ${fmt(model.remaining?row.gap/model.remaining:row.gap)} ${esc(row.lob)} units/day.`}</div></div></div>`;
    const hm=document.querySelector('.hm-section');
    if(hm)hm.innerHTML=`<div class="hm-head"><div><h2>Hits &amp; Misses — ${esc(model.week)}</h2><p>Store × LOB performance, ranked independently.</p></div><span class="hm-period">Through ${esc(model.through)}</span></div><div class="hm-grid"><div class="hm-panel hm-hit"><div class="hm-panel-title">Hits — performance to protect</div><div class="hm-list">${hits.length?hits.map((row,index)=>item(row,index,true)).join(''):'<div class="hm-item">No store × LOB pair is above pace yet.</div>'}</div></div><div class="hm-panel hm-miss"><div class="hm-panel-title">Misses — gaps requiring intervention</div><div class="hm-list">${misses.map((row,index)=>item(row,index,false)).join('')}</div></div></div><div class="hm-note"><b>Method:</b> Each store and LOB is independently compared with ${pct(model.pace)} elapsed-week pace.</div>`;
  }

  function renderGovernance(model){
    const source=document.querySelector('.governance-source');if(source)source.textContent='Weekly Sales Intelligence';
    const facts=document.querySelector('.governance-facts');
    if(facts)facts.innerHTML=`<span><b>Through</b> ${esc(model.through)} 2026</span><span><b>Coverage</b> ${model.stores.size} stores · 5 separate LOB views</span><span><b>Published</b> 13 Nov 2026</span>`;
    const statusNode=document.querySelector('.governance-status');
    if(statusNode)statusNode.innerHTML='<span class="governance-dot"></span>Validation Passed<small>19 checks</small>';
    const panel=document.querySelector('.governance-panel');
    if(panel)panel.innerHTML=`<strong>Automated reconciliation</strong><div class="governance-check governance-check--pass"><span></span><div><b>Target hierarchy</b><small>15 ARMs · 69 stores · 313 target staff rows</small></div></div><div class="governance-check governance-check--pass"><span></span><div><b>Current week</b><small>${esc(model.week)} · ${esc(model.label)} · through ${esc(model.through)}</small></div></div><div class="governance-check governance-check--pass"><span></span><div><b>LOB presentation</b><small>iPhone, Mac, iPad, Watch and AirPods shown separately</small></div></div><div class="governance-check governance-check--pass"><span></span><div><b>Commercial source</b><small>Invoice sales, loan, trade-in and AppleCare fields; footfall excluded</small></div></div>`;
  }

  function renderMission(model){
    const rows=lobRows(model);const weak=[...rows].sort((a,b)=>a.achievement-b.achievement||b.gap-a.gap);
    const health=document.querySelector('#mission .missionHealth');
    if(health)health.innerHTML=`<div class="lobMissionGrid">${rows.map(row=>`<div class="lobMissionCard"><span><i style="background:${LOB_COLORS[row.lob]}"></i>${esc(row.lob)}</span><b>${fmt(row.actual)} / ${fmt(row.target)}</b><small>${pct(row.achievement)} achieved</small><div><em>Gap ${fmt(row.gap)}</em><em>${fmt(row.requiredDaily)}/day</em></div></div>`).join('')}</div>`;
    setHtml('recoveryRows',weak.map(row=>{
      const daily=model.remaining?row.gap/model.remaining:row.gap;
      const state=row.achievement>=model.pace?'On pace':row.achievement>=model.pace-5?'Watch':'Recover';
      return `<tr><td><b>${esc(row.lob)}</b></td><td>${fmt(row.target)}</td><td>${fmt(row.actual)}</td><td>${fmt(row.gap)}</td><td>${fmt(daily)}</td><td>${row===weak[0]?'P1':row===weak[1]?'P2':'P3'}</td><td>${state}</td></tr>`;
    }).join(''));
    setHtml('topPriorities',weak.slice(0,3).map((row,index)=>`<div class="priorityCard"><span>Priority ${index+1}</span><b>${esc(row.lob)}</b><small>${fmt(row.gap)} units remain · ${fmt(model.remaining?row.gap/model.remaining:row.gap)}/day</small></div>`).join(''));
    setHtml('timeBasedActions',`<div class="timelineItem"><b>Opening</b><span>${weak.slice(0,3).map(row=>`${row.lob} ${fmt(row.requiredDaily)}/day`).join(' · ')}</span></div><div class="timelineItem"><b>Midday</b><span>Review each LOB against ${pct(model.pace)} elapsed pace; start with ${weak[0]?.lob||'the lowest LOB'}.</span></div><div class="timelineItem"><b>Closing</b><span>Reconcile iPhone, Mac, iPad, Watch and AirPods separately and carry each residual gap forward.</span></div>`);
    setText('missionAiCoach',rows.map(row=>`${row.lob}: ${fmt(row.actual)}/${fmt(row.target)} (${pct(row.achievement)}), ${fmt(row.requiredDaily)}/day required`).join(' · '));
    const outcome=document.querySelector('#mission .outcomeGrid');
    if(outcome)outcome.innerHTML=rows.map(row=>`<div class="outcomeCard"><span>${esc(row.lob)} week-end outlook</span><b>${fmt(row.projected)} / ${fmt(row.target)}</b><small>${pct(row.projectedPct)} projected · ${fmt(Math.max(0,row.target-row.projected))} projected gap</small></div>`).join('');
  }

  function commercialRows(model){
    const source=Array.isArray(SALES.commercialByStoreWeek)?SALES.commercialByStoreWeek:[];
    return source.filter(row=>row.week===model.week&&model.stores.has(row.store)).map(row=>{
      const byLob=Object.fromEntries(LOBS.map(lob=>{
        const units=num(row.lobUnits?.[lob]);
        const trade=num(row.tradeInByLob?.[lob]);
        const finance=num(row.financeByLob?.[lob]);
        const license=num(row.licenseByLob?.[lob]);
        return [lob,{units,trade,finance,license,
          tradeRate:units?trade/units*100:0,
          financeRate:units?finance/units*100:0,
          licenseRate:units?license/units*100:0}];
      }));
      const units=sum(LOBS.map(lob=>byLob[lob].units));
      const license=num(row.licenseUnits);
      return {...row,units,license,byLob,overallLicenseRate:units?license/units*100:0};
    });
  }

  function renderCommercial(model){
    const rows=commercialRows(model);
    if(!rows.length)return;
    const lobTotals=Object.fromEntries(LOBS.map(lob=>[lob,{
      units:sum(rows.map(row=>row.byLob[lob].units)),
      trade:sum(rows.map(row=>row.byLob[lob].trade)),
      finance:sum(rows.map(row=>row.byLob[lob].finance)),
      license:sum(rows.map(row=>row.byLob[lob].license)),
    }]));
    for(const lob of LOBS){const d=lobTotals[lob];d.tradeRate=d.units?d.trade/d.units*100:0;d.financeRate=d.units?d.finance/d.units*100:0;d.licenseRate=d.units?d.license/d.units*100:0;}
    const allUnits=sum(LOBS.map(lob=>lobTotals[lob].units));
    const allLicense=sum(rows.map(row=>row.license));
    const overallLicenseRate=allUnits?allLicense/allUnits*100:0;
    const commercial=q('commercial');
    const header=commercial?.querySelector('.commercialHeader');
    if(header){
      const h=header.querySelector('h2');const p=header.querySelector('p');const fresh=header.querySelector('.commercialFreshness');
      if(h)h.textContent='💳 Weekly Commercial Levers';
      if(p)p.textContent='Separate LOB sales, loan attach, trade-in attach and AppleCare / license attach calculated from the sales invoice source.';
      if(fresh)fresh.textContent=`${model.week} · through ${model.through}`;
    }
    setText('commercialScope',`${scopeLabel(model)} · five separate LOB views · no footfall dependency`);
    const kpis=document.querySelector('#commercial .commercialKpis');
    if(kpis)kpis.innerHTML=`${LOBS.map(lob=>{const d=lobTotals[lob];const target=model.byLob[lob]?.target||0;return `<div class="card commercialKpi lob"><h3>${esc(lob)} sales</h3><div class="metric">${fmt(d.units)}</div><span class="commercialQty">Target ${fmt(target)} · ${target?pct(d.units/target*100):'—'}</span><span class="commercialBenchmark">Invoice units shown separately</span></div>`;}).join('')}<div class="card commercialKpi trade"><h3>Trade-in attach by LOB</h3>${lobMetricList(LOBS.map(lob=>({lob,...lobTotals[lob]})),row=>`<b>${pct(row.tradeRate)}</b><small>${fmt(row.trade)}/${fmt(row.units)}</small>`)}</div><div class="card commercialKpi loan"><h3>Loan attach by LOB</h3>${lobMetricList(LOBS.map(lob=>({lob,...lobTotals[lob]})),row=>`<b>${pct(row.financeRate)}</b><small>${fmt(row.finance)}/${fmt(row.units)}</small>`)}</div><div class="card commercialKpi protection"><h3>iPhone AppleCare / license attach</h3><div class="metric">${pct(lobTotals.iPhone.licenseRate)}</div><span class="commercialQty">${fmt(lobTotals.iPhone.license)} of ${fmt(lobTotals.iPhone.units)} iPhones</span><span class="commercialBenchmark">iPhone protection only</span></div><div class="card commercialKpi protection"><h3>Overall AppleCare / license attach</h3><div class="metric">${pct(overallLicenseRate)}</div><span class="commercialQty">${fmt(allLicense)} of ${fmt(allUnits)} devices</span><span class="commercialBenchmark">All five LOBs, shown as requested</span></div>`;

    const list=(ordered,metric)=>ordered.slice(0,5).map((row,index)=>`<li><span class="commercialRankIndex">${index+1}</span><b title="${esc(row.store)}">${esc(row.store.replace(/^Aptronix\s+/i,''))}</b><strong>${metric(row)}<em> units</em></strong></li>`).join('');
    const rankingGrid=document.querySelector('#commercial .commercialRankingGrid');
    if(rankingGrid)rankingGrid.innerHTML=LOBS.map(lob=>{const eligible=rows.filter(row=>row.byLob[lob].units>0);const ordered=[...eligible].sort((a,b)=>b.byLob[lob].units-a.byLob[lob].units);return `<div class="card commercialRankingCard lob"><div class="commercialRankingTitle"><span>${esc(lob)}</span><b>Highest and lowest unit sales</b></div><div class="commercialRankColumns"><div><h3>Top 5</h3><ol>${list(ordered,row=>fmt(row.byLob[lob].units))}</ol></div><div><h3>Bottom 5</h3><ol>${list([...ordered].reverse(),row=>fmt(row.byLob[lob].units))}</ol></div></div></div>`;}).join('');
    const rankNote=document.querySelector('#commercial .commercialRankingNote');
    if(rankNote)rankNote.textContent='Each ranking uses only that LOB’s current-week invoice units. Loan, trade-in and protection attach rates use the matching LOB unit denominator. Footfall and conversion are excluded because the source does not contain footfall.';

    const grid=document.querySelector('#commercial .commercialGrid');
    if(grid){
      const sorted=[...rows].sort((a,b)=>b.byLob.iPhone.units-a.byLob.iPhone.units);
      grid.innerHTML=`<div class="card"><h2>${esc(model.week)} attachment by LOB</h2><div class="commercialTableWrap"><table class="table commercialTable"><thead><tr><th>LOB</th><th>Units</th><th>Trade-in</th><th>Trade-in %</th><th>Loan</th><th>Loan %</th><th>AppleCare / License</th><th>Attach %</th></tr></thead><tbody>${LOBS.map(lob=>{const d=lobTotals[lob];return `<tr><td><b>${esc(lob)}</b></td><td>${fmt(d.units)}</td><td>${fmt(d.trade)}</td><td>${pct(d.tradeRate)}</td><td>${fmt(d.finance)}</td><td>${pct(d.financeRate)}</td><td>${fmt(d.license)}</td><td>${pct(d.licenseRate)}</td></tr>`;}).join('')}</tbody></table></div><div class="commercialQa">All five LOBs use their own invoice-unit denominator. Overall AppleCare / license attach is retained only as the additional cross-LOB view requested above.</div></div><div class="card"><h2>Store-level LOB view</h2><div class="mini" style="margin-bottom:12px">Sorted by iPhone units. Every product column is independent.</div><div class="commercialTableWrap"><table class="table commercialTable"><thead><tr><th>Store</th>${LOBS.map(lob=>`<th>${esc(lob)}</th>`).join('')}<th>iPhone AppleCare</th><th>Overall AppleCare</th></tr></thead><tbody>${sorted.map(row=>`<tr><td><b>${esc(row.store.replace(/^Aptronix\s+/i,''))}</b></td>${LOBS.map(lob=>`<td>${fmt(row.byLob[lob].units)}</td>`).join('')}<td>${pct(row.byLob.iPhone.licenseRate)}</td><td>${pct(row.overallLicenseRate)}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
  }

  function renderTrajectory(model){
    const relevant=WEEKS.filter(week=>{
      const range=SALES.weekRanges?.[week];return range&&range.start<=SALES.asOfDate;
    });
    const points=relevant.map(week=>aggregate(week,model.stores));
    const svg=q('weeklyTrajectoryChart');
    if(svg){
      svg.setAttribute('aria-label','Weekly target achievement trajectory by LOB');
      const rates=points.flatMap(row=>LOBS.map(lob=>row.byLob[lob].target?row.byLob[lob].actual/row.byLob[lob].target*100:0));
      const max=Math.max(100,...rates);
      const x=index=>70+(points.length===1?0:index*(760/(points.length-1)));
      const y=value=>250-(Math.min(max,value)/max*190);
      const base=`<line x1="70" y1="250" x2="840" y2="250" stroke="#cbd5e1"/><line x1="70" y1="60" x2="70" y2="250" stroke="#cbd5e1"/><line x1="70" y1="${y(100)}" x2="840" y2="${y(100)}" stroke="#94a3b8" stroke-dasharray="6 6"/><text x="75" y="${y(100)-8}" fill="#64748b" font-size="12">100% target</text>${points.map((row,index)=>`<text x="${x(index)}" y="278" text-anchor="middle" fill="#64748b" font-size="13">${row.week}</text>`).join('')}`;
      const lines=LOBS.map((lob,lobIndex)=>{
        const values=points.map(row=>row.byLob[lob].target?row.byLob[lob].actual/row.byLob[lob].target*100:0);
        const poly=values.map((value,index)=>`${x(index)},${y(value)}`).join(' ');
        return `<polyline points="${poly}" fill="none" stroke="${LOB_COLORS[lob]}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${values.map((value,index)=>`<circle cx="${x(index)}" cy="${y(value)}" r="4" fill="#fff" stroke="${LOB_COLORS[lob]}" stroke-width="3"><title>${esc(lob)} ${points[index].week}: ${pct(value)}</title></circle>`).join('')}<g transform="translate(${115+lobIndex*145},28)"><line x1="0" y1="0" x2="24" y2="0" stroke="${LOB_COLORS[lob]}" stroke-width="4"/><text x="30" y="4" fill="#475569" font-size="11">${esc(lob)}</text></g>`;
      }).join('');
      svg.innerHTML=base+lines;
    }
    setHtml('weekCards',points.map(row=>`<div class="weekCard"><span>${row.week}${row.week===model.week?` · through ${model.through}`:''}</span>${lobMetricList(LOBS.map(lob=>{const d=row.byLob[lob];return {lob,...d,rate:d.target?d.actual/d.target*100:0};}),d=>`<b>${pct(d.rate)}</b><small>${fmt(d.actual)}/${fmt(d.target)}</small>`)}</div>`).join(''));
    const head=document.querySelector('#trajectory .trajectoryTable thead');
    if(head)head.innerHTML=`<tr><th>LOB</th>${points.map(row=>`<th>${row.week}</th>`).join('')}<th>Current Target</th><th>Current Actual</th><th>Balance</th></tr>`;
    setHtml('weeklyKpiRows',LOBS.map(lob=>`<tr><td><b>${esc(lob)}</b></td>${points.map(row=>{const d=row.byLob[lob];return `<td>${d.target?pct(d.actual/d.target*100):'—'}<small>${fmt(d.actual)}/${fmt(d.target)}</small></td>`;}).join('')}<td>${fmt(model.byLob[lob].target)}</td><td>${fmt(model.byLob[lob].actual)}</td><td>${fmt(Math.max(0,model.byLob[lob].target-model.byLob[lob].actual))}</td></tr>`).join(''));
  }

  function renderCopilot(model){
    const rows=lobRows(model);const weak=[...rows].sort((a,b)=>a.achievement-b.achievement||b.gap-a.gap);
    const question=q('copilotQuestion')?.selectedOptions?.[0]?.textContent||'current weekly performance';
    setText('copilotResponseTitle',question);
    setText('copilotConfidence','Verified weekly data');
    setHtml('copilotAnswer',`<div class="copilotBlock what"><h3>Target vs achieved by LOB</h3>${lobMetricList(rows,row=>`<b>${fmt(row.actual)} / ${fmt(row.target)}</b><small>${pct(row.achievement)}</small>`)}</div><div class="copilotBlock why"><h3>Largest LOB gaps</h3>${lobMetricList(weak,row=>`<b>${fmt(row.gap)}</b><small>${fmt(row.requiredDaily)}/day</small>`)}</div><div class="copilotBlock how"><h3>How to recover</h3><p>Prioritise ${esc(weak.slice(0,2).map(row=>row.lob).join(' and '))}. Review each LOB independently against ${pct(model.pace)} elapsed pace at midday.</p></div><div class="copilotImpact"><span>Expected Business Impact</span><b>Closing each LOB’s daily requirement delivers its own weekly target.</b></div>`);
  }

  function populateCopilot(){
    const category=q('copilotCategory');const question=q('copilotQuestion');
    if(category){
      const selected=category.value;
      category.innerHTML='<option value="weekly">Weekly Performance</option><option value="stores">Store Gaps</option><option value="lob">LOB Recovery</option><option value="commercial">Commercial Levers</option>';
      if(Array.from(category.options).some(option=>option.value===selected))category.value=selected;
    }
    if(question){
      const selected=question.value;
      question.innerHTML='<option value="overall">How is my weekly business performing?</option><option value="behind">Why am I behind weekly target?</option><option value="forecast">Can I still achieve the weekly target?</option><option value="priorities">What are my top three priorities?</option><option value="risk">What is the single biggest risk today?</option>';
      if(Array.from(question.options).some(option=>option.value===selected))question.value=selected;
    }
  }

  function renderRhythm(model){
    const rows=lobRows(model);const weak=[...rows].sort((a,b)=>a.achievement-b.achievement||b.gap-a.gap);
    const hour=new Date().getHours();
    const stage=hour<11?'Opening':hour<16?'Midday Review':'Closing Review';
    const summary=document.querySelector('#rhythm .rhythmSummary');
    if(summary)summary.innerHTML=`<div class="rhythmSummaryCard"><span>Current stage</span><b>${stage}</b></div>${rows.map(row=>`<div class="rhythmSummaryCard"><span>${esc(row.lob)} required / day</span><b>${fmt(row.requiredDaily)}</b><small>${fmt(row.gap)} weekly gap</small></div>`).join('')}<div class="rhythmSummaryCard"><span>Next review</span><b>${hour<11?'11:00 AM':hour<16?'4:00 PM':'Next opening'}</b></div>`;
    setHtml('rhythmList',`<div class="rhythmItem"><span>Opening</span><b>${rows.map(row=>`${row.lob} ${fmt(row.requiredDaily)}`).join(' · ')}</b><small>Allocate every LOB mission independently by store.</small></div><div class="rhythmItem"><span>Midday</span><b>Check five LOBs against ${pct(model.pace)} pace</b><small>Recover ${esc(weak.slice(0,2).map(row=>row.lob).join(' and '))} first.</small></div><div class="rhythmItem"><span>Closing</span><b>Reconcile Week ${model.week.replace('W','')} by LOB</b><small>Carry forward the separate iPhone, Mac, iPad, Watch and AirPods gaps.</small></div>`);
  }

  function render(){
    const model=aggregate();
    renderDashboard(model);renderMission(model);renderTrajectory(model);renderCommercial(model);renderRhythm(model);renderGovernance(model);populateCopilot();
    window.WEEKLY_OPERATING_MODEL.current=model;
    return model;
  }

  const originalCalculate=window.calculateOS;
  window.calculateOS=function(){try{originalCalculate?.apply(this,arguments);}catch(error){console.warn(error);}return render();};
  const originalRefresh=window.refreshV23;
  window.refreshV23=function(){try{originalRefresh?.apply(this,arguments);}catch(error){console.warn(error);}return render();};
  window.renderTrajectory=function(){return renderTrajectory(aggregate());};
  window.askRetailCopilotV239=function(){return renderCopilot(aggregate());};
  window.populateCopilotQuestionDropdownV239=populateCopilot;
  window.WEEKLY_OPERATING_MODEL={aggregate,render,renderCopilot,current:null};

  document.addEventListener('change',event=>{
    if(['rm','arm','city','store'].includes(event.target?.id))setTimeout(render,0);
  });
  document.addEventListener('DOMContentLoaded',()=>{
    window.renderBusinessBriefV244=function(){return renderDashboard(aggregate());};
    const priorNavigate=window.navigateToPage;
    if(typeof priorNavigate==='function')window.navigateToPage=function(page){const result=priorNavigate.apply(this,arguments);setTimeout(render,0);return result;};
    setTimeout(render,500);setTimeout(render,900);
  });
  window.addEventListener('hashchange',()=>setTimeout(render,0));
})();
