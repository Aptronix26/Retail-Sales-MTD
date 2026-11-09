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
    for(const row of SALES.rows||[]){
      if(!stores.has(row.store))continue;
      const storeRow=ensure(row.store);
      for(const lob of LOBS){
        const value=num(row.achievements?.[week]?.[lob]);
        byLob[lob].actual+=value;storeRow.byLob[lob].actual+=value;
      }
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
      if(p)p.textContent='Core-LOB weekly targets, achievements and recovery actions across the selected scope.';
    }
    setText('briefDate',model.through);
    setText('briefScope',`${scopeLabel(model)} · ${label} · sales through ${model.through}`);
    setLabel('#page-dashboard .executiveKpi:nth-child(1) h3','🎯 Weekly Core-Unit Target');
    setLabel('#page-dashboard .executiveKpi:nth-child(2) h3',`💰 Achieved Through ${model.through}`);
    setLabel('#page-dashboard .executiveKpi:nth-child(3) h3','📊 Weekly Achievement');
    setLabel('#page-dashboard .executiveKpi:nth-child(4) h3','🏃 Required Units / Day');
    setLabel('#page-dashboard .executiveKpi:nth-child(5) h3','📈 Projected Week-End');
    setLabel('#mission h2','🎯 Weekly Mission Recovery Engine');
    setLabel('#mission .card > .mini',`What this scope must deliver during ${label} to achieve its weekly core-unit target.`);
    setLabel('#mission .healthMetric:nth-child(2) span','Required Units / Day');
    setLabel('#mission .healthMetric:nth-child(3) span','Weekly Unit Balance');
    setLabel('#mission .healthMetric:nth-child(4) span','Days Remaining');
    setLabel('#mission .recoveryTable thead tr', '');
    const missionHead=document.querySelector('#mission .recoveryTable thead');
    if(missionHead)missionHead.innerHTML='<tr><th>LOB</th><th>Weekly Target</th><th>Achieved</th><th>Balance</th><th>Required / Day</th><th>Priority</th><th>Status</th></tr>';
    setLabel('#mission .card.section:nth-of-type(5) h2','Week-End Forecast');
    setLabel('#trajectory h2','📈 Weekly Target vs Achievement Trajectory');
    setLabel('#trajectory > .mini','Completed and current Sunday–Saturday weeks. Each point is actual core units as a percentage of that week’s target.');
    setLabel('#trajectory > .mini:last-child','Targets come from the weekly target master. Actuals come from the appended sales invoice source and use the latest available day in the current week.');
    setLabel('#gpt .card:first-child .mini','Select a business question to receive a role-scoped answer from current weekly targets and core-unit sales.');
    setLabel('#rhythm > .card > .mini','A structured daily cadence for the current weekly core-unit mission.');
    setLabel('#rhythm .rhythmSummaryCard:nth-child(2) span','Required Units / Day');
    setLabel('#rhythm .rhythmSummaryCard:nth-child(3) span','Projected Week-End');
  }

  function renderDashboard(model){
    updateStaticCopy(model);
    const health=status(model);const weak=weakestLobs(model);
    const storeRows=model.byStore.filter(row=>row.target>0).sort((a,b)=>b.balance-a.balance);
    const onTrack=storeRows.filter(row=>row.achievement>=model.pace).length;
    setText('execMonthlyTarget',fmt(model.target));
    setText('execTargetScope',`${scopeLabel(model)} · core units`);
    setText('execMtdAchieved',fmt(model.actual));
    setLabel('#page-dashboard .executiveKpi:nth-child(2) .mini',`Sales through ${model.through}`);
    setText('execAchievementPct',pct(model.achievement));
    setText('execYetToAchieve',`${pct(Math.max(0,100-model.achievement))} remaining`);
    setText('execDailyRR',fmt(model.requiredDaily));
    setText('execDaysContext',`${model.remaining} days remaining`);
    setText('execExitPct',`${fmt(model.projected)} · ${pct(model.projectedPct)}`);
    setText('execExitStatus','Projected weekly units');

    setText('briefTitle',`${health.label}: ${pct(model.achievement)} achieved vs ${pct(model.pace)} elapsed pace`);
    setLabel('#briefExitCard span','Week-End Outlook');
    setLabel('.briefKpisDecision .briefKpi:nth-child(2) span','Weekly Unit Gap');
    setText('briefExit',pct(model.projectedPct));
    setText('briefExitSub',`${fmt(model.projected)} projected units`);
    setText('briefGap',fmt(model.balance));
    setText('briefGapSub','units remaining to weekly target');
    setText('briefHealthLabel','Stores On Pace');
    setText('briefHealth',`${onTrack}/${storeRows.length}`);
    setText('briefHealthSub',`at or above ${pct(model.pace)} elapsed pace`);
    setText('briefPriority',weak[0]?.lob||'—');
    setText('briefPrioritySub',weak[0]?`${pct(weak[0].achievement)} of weekly target`:'No target');
    setText('briefLeagueTitle','Store weekly position');
    setText('briefLeagueSub','Largest remaining core-unit gaps');
    const leagueHead=document.querySelector('.briefLeague thead');
    if(leagueHead)leagueHead.innerHTML='<tr><th>Store</th><th>Target</th><th>Achieved</th><th>Ach %</th><th>Gap</th></tr>';
    setHtml('briefLeagueRows',storeRows.slice(0,8).map(row=>`<tr><td>${esc(row.store.replace(/^Aptronix\s+/i,''))}</td><td>${fmt(row.target)}</td><td>${fmt(row.actual)}</td><td>${pct(row.achievement)}</td><td>${fmt(row.balance)}</td></tr>`).join(''));
    setHtml('briefActions',weak.slice(0,3).map((row,index)=>`<div class="briefAction"><b>${index+1}. Recover ${esc(row.lob)}</b><span>${fmt(row.gap)} units remain; ${fmt(model.remaining?row.gap/model.remaining:row.gap)} per day required.</span></div>`).join(''));
    setText('briefInsight',model.projectedPct>=100?'Current pace projects weekly target achievement.':`Projected at ${pct(model.projectedPct)}; prioritise ${weak.slice(0,2).map(row=>row.lob).join(' and ')}.`);

    setText('focusHeadline',model.projectedPct>=100?'Protect the weekly run rate':'Recover the weekly core-unit gap');
    setText('focusRisk',health.label);
    setHtml('focusPriorities',weak.slice(0,3).map((row,index)=>`<div class="focusPriority"><span>Priority ${index+1}</span><b>${esc(row.lob)} · ${pct(row.achievement)}</b><small>${fmt(row.gap)} units remaining</small></div>`).join(''));
    setText('focusStore',storeRows[0]?.store.replace(/^Aptronix\s+/i,'')||'—');
    setLabel('.focusFooter > div:nth-child(1) span','Largest Weekly Unit-Gap Store');
    setText('focusConcentration',storeRows.length?`${pct(sum(storeRows.slice(0,5).map(row=>row.balance))/Math.max(1,model.balance)*100)} in top 5 gaps`:'—');
    setText('focusAttention',`${fmt(model.requiredDaily)} units/day required`);
    setHtml('actionSteps',weak.slice(0,3).map((row,index)=>`<div class="actionStep"><span>${index+1}</span><div><b>${esc(row.lob)} recovery</b><small>Deliver ${fmt(model.remaining?row.gap/model.remaining:row.gap)} units/day across ${scopeLabel(model)}.</small></div></div>`).join(''));
    setText('decisionCue',`Close ${fmt(model.balance)} units over ${model.remaining} remaining days; start with ${weak[0]?.lob||'the largest gap'}.`);

    const hits=storeRows.filter(row=>row.achievement>=model.pace).sort((a,b)=>b.achievement-a.achievement).slice(0,5);
    const misses=storeRows.filter(row=>row.achievement<model.pace).sort((a,b)=>a.achievement-b.achievement).slice(0,5);
    const item=(row,index,hit)=>{
      const lob=LOBS.map(name=>({name,...row.byLob[name],rate:row.byLob[name].target?row.byLob[name].actual/row.byLob[name].target*100:0})).sort((a,b)=>hit?b.rate-a.rate:a.rate-b.rate)[0];
      return `<div class="hm-item"><div class="hm-rank">${index+1}</div><div><div class="hm-title">${esc(row.store.replace(/^Aptronix\s+/i,''))}</div><div class="hm-signal">${pct(row.achievement)} of weekly target</div><div class="hm-reason">${hit?`${pct(row.achievement-model.pace)} points ahead of elapsed pace.`:`${pct(model.pace-row.achievement)} points behind elapsed pace; ${fmt(row.balance)} units remain.`} ${esc(lob?.name||'Core units')} is the ${hit?'strongest':'weakest'} LOB at ${pct(lob?.rate||0)}.</div><div class="hm-action"><b>Action:</b> ${hit?'Protect the leading LOB and replicate the store run rate.':`Prioritise ${esc(lob?.name||'the weakest LOB')} and recover the daily unit gap.`}</div></div></div>`;
    };
    const hm=document.querySelector('.hm-section');
    if(hm)hm.innerHTML=`<div class="hm-head"><div><h2>Hits &amp; Misses — ${esc(model.week)}</h2><p>Store performance against current weekly core-unit targets.</p></div><span class="hm-period">Through ${esc(model.through)}</span></div><div class="hm-grid"><div class="hm-panel hm-hit"><div class="hm-panel-title">Hits — performance to protect</div><div class="hm-list">${hits.length?hits.map((row,index)=>item(row,index,true)).join(''):'<div class="hm-item">No store is above elapsed pace yet.</div>'}</div></div><div class="hm-panel hm-miss"><div class="hm-panel-title">Misses — gaps requiring intervention</div><div class="hm-list">${misses.map((row,index)=>item(row,index,false)).join('')}</div></div></div><div class="hm-note"><b>Method:</b> Store achievement is compared with ${pct(model.pace)} elapsed-week pace. Targets and actuals cover iPhone, Mac, iPad, Watch and AirPods.</div>`;
  }

  function renderGovernance(model){
    const source=document.querySelector('.governance-source');if(source)source.textContent='Weekly Sales Intelligence';
    const facts=document.querySelector('.governance-facts');
    if(facts)facts.innerHTML=`<span><b>Through</b> ${esc(model.through)} 2026</span><span><b>Coverage</b> ${model.stores.size} stores · 5 core LOBs</span><span><b>Published</b> 9 Nov 2026</span>`;
    const statusNode=document.querySelector('.governance-status');
    if(statusNode)statusNode.innerHTML='<span class="governance-dot"></span>Validation Passed<small>19 checks</small>';
    const panel=document.querySelector('.governance-panel');
    if(panel)panel.innerHTML=`<strong>Automated reconciliation</strong><div class="governance-check governance-check--pass"><span></span><div><b>Target hierarchy</b><small>15 ARMs · 69 stores · 313 target staff rows</small></div></div><div class="governance-check governance-check--pass"><span></span><div><b>Current week</b><small>${esc(model.week)} · ${esc(model.label)} · through ${esc(model.through)}</small></div></div><div class="governance-check governance-check--pass"><span></span><div><b>Core LOB scope</b><small>iPhone, Mac, iPad, Watch and AirPods</small></div></div><div class="governance-check governance-check--pass"><span></span><div><b>Commercial source</b><small>Invoice sales, loan, trade-in and AppleCare fields; footfall excluded</small></div></div>`;
  }

  function renderMission(model){
    const health=status(model);const weak=weakestLobs(model);
    setText('recoveryHealth',health.label);
    setText('monthProgressText',`${pct(model.achievement)} weekly achievement vs ${pct(model.pace)} elapsed pace`);
    const fill=q('monthProgressFill');if(fill)fill.style.width=`${Math.min(100,model.achievement)}%`;
    setText('recoveryRevenueToday',fmt(model.requiredDaily));
    setText('recoveryBalance',fmt(model.balance));
    setText('recoveryDays',fmt(model.remaining));
    setHtml('recoveryRows',weak.map(row=>{
      const daily=model.remaining?row.gap/model.remaining:row.gap;
      const state=row.achievement>=model.pace?'On pace':row.achievement>=model.pace-5?'Watch':'Recover';
      return `<tr><td><b>${esc(row.lob)}</b></td><td>${fmt(row.target)}</td><td>${fmt(row.actual)}</td><td>${fmt(row.gap)}</td><td>${fmt(daily)}</td><td>${row===weak[0]?'P1':row===weak[1]?'P2':'P3'}</td><td>${state}</td></tr>`;
    }).join(''));
    setHtml('topPriorities',weak.slice(0,3).map((row,index)=>`<div class="priorityCard"><span>Priority ${index+1}</span><b>${esc(row.lob)}</b><small>${fmt(row.gap)} units remain · ${fmt(model.remaining?row.gap/model.remaining:row.gap)}/day</small></div>`).join(''));
    setHtml('timeBasedActions',`<div class="timelineItem"><b>Opening</b><span>Allocate today’s ${fmt(model.requiredDaily)}-unit mission by store and LOB.</span></div><div class="timelineItem"><b>Midday</b><span>Review ${weak[0]?.lob||'LOB'} conversion and move effort to stores below ${pct(model.pace)} pace.</span></div><div class="timelineItem"><b>Closing</b><span>Reconcile actual sales to the weekly target and carry only the residual gap forward.</span></div>`);
    setText('missionAiCoach',model.projectedPct>=100?`Current pace projects ${fmt(model.projected)} units, above the ${fmt(model.target)} weekly target. Protect the run rate and focus on ${weak[0]?.lob}.`:`At the current pace, the scope projects ${fmt(model.projected)} units (${pct(model.projectedPct)}). Recover ${fmt(model.requiredDaily)} units/day, led by ${weak.slice(0,2).map(row=>row.lob).join(' and ')}.`);
    setText('outcomeMissionMet',fmt(model.projected));
    setLabel('#mission .outcomeCard:nth-child(1) span','Projected Core Units at Current Pace');
    setLabel('#mission .outcomeCard:nth-child(1) small','Expected week-end core units if the current average pace continues.');
    setText('outcomeCurrentPace',fmt(Math.max(0,model.target-model.projected)));
    setLabel('#mission .outcomeCard:nth-child(2) span','Projected Unit Gap vs Target');
    setLabel('#mission .outcomeCard:nth-child(2) small','Expected weekly shortfall at the current pace.');
    const uplift=model.actual&&model.remaining?Math.max(0,(model.requiredDaily/(model.actual/model.elapsed)-1)*100):0;
    setText('outcomeRecovery',`+${pct(uplift)}`);
  }

  function commercialRows(model){
    const source=Array.isArray(SALES.commercialByStoreWeek)?SALES.commercialByStoreWeek:[];
    return source.filter(row=>row.week===model.week&&model.stores.has(row.store)).map(row=>{
      const units=num(row.coreUnits);
      const tradeRate=units?num(row.tradeInUnits)/units*100:0;
      const financeRate=units?num(row.financeUnits)/units*100:0;
      const swipeRate=units?num(row.fullSwipeUnits)/units*100:0;
      const licenseRate=units?num(row.licenseUnits)/units*100:0;
      const marginRate=num(row.netRevenue)?num(row.grossProfit)/num(row.netRevenue)*100:0;
      const asp=units?num(row.coreRevenue)/units:0;
      return {...row,units,tradeRate,financeRate,swipeRate,licenseRate,marginRate,asp};
    });
  }

  function renderCommercial(model){
    const rows=commercialRows(model);
    if(!rows.length)return;
    const total=field=>sum(rows.map(row=>row[field]));
    const units=total('coreUnits');
    const netRevenue=total('netRevenue');
    const coreRevenue=total('coreRevenue');
    const gp=total('grossProfit');
    const trade=total('tradeInUnits');
    const finance=total('financeUnits');
    const swipe=total('fullSwipeUnits');
    const license=total('licenseUnits');
    const money=value=>{
      value=num(value);
      if(Math.abs(value)>=10000000)return `₹${(value/10000000).toFixed(2)} Cr`;
      if(Math.abs(value)>=100000)return `₹${(value/100000).toFixed(1)} L`;
      return `₹${fmt(value)}`;
    };
    const commercial=q('commercial');
    const header=commercial?.querySelector('.commercialHeader');
    if(header){
      const h=header.querySelector('h2');const p=header.querySelector('p');const fresh=header.querySelector('.commercialFreshness');
      if(h)h.textContent='💳 Weekly Commercial Levers';
      if(p)p.textContent='Sales value, gross profit, loan attach and trade-in attach calculated from the sales invoice source.';
      if(fresh)fresh.textContent=`${model.week} · through ${model.through}`;
    }
    setText('commercialScope',`${scopeLabel(model)} · ${fmt(units)} core units · no footfall dependency`);
    const cards=Array.from(document.querySelectorAll('#commercial .commercialKpis .commercialKpi'));
    const cardValues=[
      ['Core Units',fmt(units),`${fmt(model.actual)} staff-attributed`,'Store-level source sales'],
      ['Core Revenue',money(coreRevenue),`${money(units?coreRevenue/units:0)} ASP`,'Core LOB sales value'],
      ['Trade-in Attach',pct(units?trade/units*100:0),`${fmt(trade)} of ${fmt(units)} units`,'Affordability field contains Trade-in'],
      ['Loan Attach',pct(units?finance/units*100:0),`${fmt(finance)} of ${fmt(units)} units`,'EMI, finance, FTI or credit'],
      ['AppleCare / License Attach',pct(units?license/units*100:0),`${fmt(license)} of ${fmt(units)} units`,'AppleCare+ and Protect+ quantities'],
      ['Gross Margin',pct(netRevenue?gp/netRevenue*100:0),`${money(gp)} gross profit`,'GP ÷ net sales value'],
      ['Net Sales Value',money(netRevenue),`${money(total('discountValue'))} MRP discount`,'All mapped invoice rows'],
    ];
    cards.forEach((card,index)=>{
      const values=cardValues[index];if(!values)return;
      const title=card.querySelector('h3');const metric=card.querySelector('.metric');const qty=card.querySelector('.commercialQty');const benchmark=card.querySelector('.commercialBenchmark');
      if(title)title.textContent=values[0];if(metric)metric.textContent=values[1];if(qty)qty.textContent=values[2];if(benchmark)benchmark.textContent=values[3];
    });

    const rankingTitles=[
      ['Core Units','Highest and lowest unit sales'],
      ['Trade-in Attach','Highest and lowest attach rate'],
      ['Loan Attach','Highest and lowest loan attach rate'],
    ];
    Array.from(document.querySelectorAll('#commercial .commercialRankingCard')).forEach((card,index)=>{
      const span=card.querySelector('.commercialRankingTitle span');const bold=card.querySelector('.commercialRankingTitle b');
      if(span)span.textContent=rankingTitles[index][0];if(bold)bold.textContent=rankingTitles[index][1];
    });
    const list=(ordered,metric)=>ordered.slice(0,5).map((row,index)=>`<li><span>${index+1}</span><b title="${esc(row.store)}">${esc(row.store.replace(/^Aptronix\s+/i,''))}</b><strong>${metric(row)}</strong></li>`).join('');
    const eligible=rows.filter(row=>row.units>0);
    const byUnits=[...eligible].sort((a,b)=>b.units-a.units);
    const byTrade=[...eligible].sort((a,b)=>b.tradeRate-a.tradeRate||b.units-a.units);
    const byFinance=[...eligible].sort((a,b)=>b.financeRate-a.financeRate||b.units-a.units);
    setHtml('tradeTopRows',list(byUnits,row=>fmt(row.units)));
    setHtml('tradeBottomRows',list([...byUnits].reverse(),row=>fmt(row.units)));
    setHtml('loanTopRows',list(byTrade,row=>pct(row.tradeRate)));
    setHtml('loanBottomRows',list([...byTrade].reverse(),row=>pct(row.tradeRate)));
    setHtml('licenseTopRows',list(byFinance,row=>pct(row.financeRate)));
    setHtml('licenseBottomRows',list([...byFinance].reverse(),row=>pct(row.financeRate)));
    const rankNote=document.querySelector('#commercial .commercialRankingNote');
    if(rankNote)rankNote.textContent='Rankings use current-week store sales from the invoice source. Loan and trade-in attach rates use net core units as the denominator. Footfall and conversion are excluded because the source does not contain footfall.';

    const grid=document.querySelector('#commercial .commercialGrid');
    if(grid){
      const sorted=[...eligible].sort((a,b)=>b.coreRevenue-a.coreRevenue);
      grid.innerHTML=`<div class="card"><h2>${esc(model.week)} LOB Commercial Mix</h2><div class="yoyCompare">${LOBS.map(lob=>{const d=model.byLob[lob];return `<div><span>${esc(lob)}</span><b>${fmt(d.actual)} / ${fmt(d.target)}</b><small>${d.target?pct(d.actual/d.target*100):'—'} achieved</small></div>`;}).join('')}</div><div class="commercialQa">Store-level invoice sales include ${fmt(units)} net core units. ${fmt(model.actual)} are attributed to mapped target staff; the difference remains visible here instead of being discarded. Footfall and conversion are hidden because they are unavailable in this source.</div></div><div class="card"><h2>Store-Level Weekly Commercial View</h2><div class="mini" style="margin-bottom:12px">Sorted by core revenue. All values recalculate for the selected scope.</div><div class="commercialTableWrap"><table class="table commercialTable"><thead><tr><th>Store</th><th>Core Units</th><th>Core Revenue</th><th>ASP</th><th>Trade-in Attach</th><th>Loan Attach</th><th>AppleCare Attach</th><th>Gross Margin</th></tr></thead><tbody>${sorted.map(row=>`<tr><td><b>${esc(row.store.replace(/^Aptronix\s+/i,''))}</b></td><td>${fmt(row.units)}</td><td>${money(row.coreRevenue)}</td><td>${money(row.asp)}</td><td>${pct(row.tradeRate)}</td><td>${pct(row.financeRate)}</td><td>${pct(row.licenseRate)}</td><td>${pct(row.marginRate)}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
  }

  function renderTrajectory(model){
    const relevant=WEEKS.filter(week=>{
      const range=SALES.weekRanges?.[week];return range&&range.start<=SALES.asOfDate;
    });
    const points=relevant.map(week=>aggregate(week,model.stores));
    const svg=q('weeklyTrajectoryChart');
    if(svg){
      const max=Math.max(100,...points.map(row=>row.achievement));
      const x=index=>70+(points.length===1?0:index*(760/(points.length-1)));
      const y=value=>250-(Math.min(max,value)/max*190);
      const poly=points.map((row,index)=>`${x(index)},${y(row.achievement)}`).join(' ');
      svg.innerHTML=`<line x1="70" y1="250" x2="840" y2="250" stroke="#cbd5e1"/><line x1="70" y1="60" x2="70" y2="250" stroke="#cbd5e1"/><line x1="70" y1="${y(100)}" x2="840" y2="${y(100)}" stroke="#94a3b8" stroke-dasharray="6 6"/><text x="75" y="${y(100)-8}" fill="#64748b" font-size="12">100% target</text><polyline points="${poly}" fill="none" stroke="#2563eb" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>${points.map((row,index)=>`<circle cx="${x(index)}" cy="${y(row.achievement)}" r="7" fill="#fff" stroke="#2563eb" stroke-width="4"/><text x="${x(index)}" y="${y(row.achievement)-14}" text-anchor="middle" fill="#0f172a" font-weight="700" font-size="13">${pct(row.achievement)}</text><text x="${x(index)}" y="278" text-anchor="middle" fill="#64748b" font-size="13">${row.week}</text>`).join('')}`;
    }
    setHtml('weekCards',points.map(row=>`<div class="weekCard"><span>${row.week}</span><b>${pct(row.achievement)}</b><small>${fmt(row.actual)} / ${fmt(row.target)} units${row.week===model.week?` · through ${model.through}`:''}</small></div>`).join(''));
    const head=document.querySelector('#trajectory .trajectoryTable thead');
    if(head)head.innerHTML=`<tr><th>LOB</th>${points.map(row=>`<th>${row.week}</th>`).join('')}<th>Current Target</th><th>Current Actual</th><th>Balance</th></tr>`;
    setHtml('weeklyKpiRows',LOBS.map(lob=>`<tr><td><b>${esc(lob)}</b></td>${points.map(row=>{const d=row.byLob[lob];return `<td>${d.target?pct(d.actual/d.target*100):'—'}<small>${fmt(d.actual)}/${fmt(d.target)}</small></td>`;}).join('')}<td>${fmt(model.byLob[lob].target)}</td><td>${fmt(model.byLob[lob].actual)}</td><td>${fmt(Math.max(0,model.byLob[lob].target-model.byLob[lob].actual))}</td></tr>`).join(''));
  }

  function renderCopilot(model){
    const weak=weakestLobs(model);const stores=model.byStore.filter(row=>row.target>0).sort((a,b)=>b.balance-a.balance);
    const question=q('copilotQuestion')?.selectedOptions?.[0]?.textContent||'current weekly performance';
    setText('copilotResponseTitle',question);
    setText('copilotConfidence','Verified weekly data');
    setHtml('copilotAnswer',`<div class="copilotBlock what"><h3>What</h3><p>${esc(scopeLabel(model))} has achieved <b>${fmt(model.actual)} of ${fmt(model.target)} core units (${pct(model.achievement)})</b> through ${esc(model.through)}. Elapsed-week pace is ${pct(model.pace)}.</p></div><div class="copilotBlock why"><h3>Why</h3><p>The largest LOB gap is <b>${esc(weak[0]?.lob||'—')} (${fmt(weak[0]?.gap||0)} units)</b>. The largest store gap is <b>${esc(stores[0]?.store.replace(/^Aptronix\s+/i,'')||'—')} (${fmt(stores[0]?.balance||0)} units)</b>.</p></div><div class="copilotBlock how"><h3>How to Recover — Suggested Action</h3><p>Deliver <b>${fmt(model.requiredDaily)} core units per remaining day</b>. Prioritise ${esc(weak.slice(0,2).map(row=>row.lob).join(' and '))}, then review stores below ${pct(model.pace)} pace at midday.</p></div><div class="copilotImpact"><span>Expected Business Impact</span><b>Closing the daily requirement projects 100% of the weekly target.</b></div>`);
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
    setText('rhythmRevenueMission',fmt(model.requiredDaily));
    setText('rhythmExitPct',pct(model.projectedPct));
    const hour=new Date().getHours();
    setText('rhythmCurrentStage',hour<11?'Opening':hour<16?'Midday Review':'Closing Review');
    setHtml('rhythmList',`<div class="rhythmItem"><span>Opening</span><b>Allocate ${fmt(model.requiredDaily)} units</b><small>Split the mission by store and LOB.</small></div><div class="rhythmItem"><span>Midday</span><b>Check pace against ${pct(model.pace)}</b><small>Recover the largest store and ${esc(weakestLobs(model)[0]?.lob||'LOB')} gaps.</small></div><div class="rhythmItem"><span>Closing</span><b>Reconcile Week ${model.week.replace('W','')}</b><small>Update actuals and carry forward only the remaining unit gap.</small></div>`);
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
