(function(){
  let yoyMode='all';
  const q=id=>document.getElementById(id);
  const norm=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const pct=(value,base)=>base>0?value/base*100:null;
  const pctText=value=>value==null?'N/A':value.toFixed(1)+'%';
  const qtyText=value=>Math.round(value||0).toLocaleString('en-IN')+' qty';
  const money=value=>'₹'+((value||0)/10000000).toLocaleString('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2})+' Cr';
  const signedMoney=value=>(value>=0?'+':'−')+money(Math.abs(value));
  const signedPct=value=>value==null?'No LY base':(value>=0?'+':'')+value.toFixed(1)+'%';

  function scopeStores(){
    if(typeof window.scopeRowsV23==='function')return window.scopeRowsV23().map(row=>norm(row.store));
    return Object.values(window.PROD_ACH_2454||{}).map(row=>norm(row.store));
  }

  function scopedRows(){
    const allowed=new Set(scopeStores());
    const actualByStore=new Map(Object.values(window.PROD_ACH_2454||{}).map(row=>[norm(row.store),row]));
    return Object.values(window.PROD_COMMERCIAL_2454||{}).filter(row=>allowed.has(norm(row.store))).map(row=>({
      ...row,
      actual:actualByStore.get(norm(row.store))||{}
    }));
  }

  function sum(rows,key,source='row'){
    return rows.reduce((total,row)=>total+Number((source==='actual'?row.actual:row)[key]||0),0);
  }

  function aggregate(rows){
    const devices=['iphone','mac','ipad','watch','airpods'].reduce((total,key)=>total+sum(rows,key,'actual'),0);
    return {
      stores:rows.length,
      iphone:sum(rows,'iphone','actual'),mac:sum(rows,'mac','actual'),devices,
      revenue:sum(rows,'revenue','actual'),
      iphoneTradeQty:sum(rows,'iphoneTradeQty'),macTradeQty:sum(rows,'macTradeQty'),
      iphoneLoanQty:sum(rows,'iphoneLoanQty'),overallLoanQty:sum(rows,'overallLoanQty'),
      iphoneProtectionQty:sum(rows,'iphoneProtectionQty'),overallProtectionQty:sum(rows,'overallProtectionQty'),
      microsoftQty:sum(rows,'microsoftQty'),lyRevenueSameDate:sum(rows,'lyRevenueSameDate'),
      lyRevenueFullMonth:sum(rows,'lyRevenueFullMonth')
    };
  }

  function setMetric(id,qtyId,value,qty){
    if(q(id))q(id).textContent=pctText(value);
    if(q(qtyId))q(qtyId).textContent=qtyText(qty);
  }

  function renderYoy(rows){
    const eligible=rows.filter(row=>row.sameDateEligible);
    const comparisonRows=yoyMode==='lfl'?eligible:rows;
    const a=aggregate(comparisonRows);
    const delta=a.revenue-a.lyRevenueSameDate;
    const growth=a.lyRevenueSameDate>0?delta/a.lyRevenueSameDate*100:null;
    if(q('yoyGrowth'))q('yoyGrowth').textContent=signedPct(growth);
    if(q('yoyGrowthSub'))q('yoyGrowthSub').textContent=growth==null?'Selected scope has no same-date August 2025 base':`${signedMoney(delta)} vs 1–24 Aug 2025`;
    if(q('yoyCurrent'))q('yoyCurrent').textContent=money(a.revenue);
    if(q('yoyLastYear'))q('yoyLastYear').textContent=money(a.lyRevenueSameDate);
    if(q('yoyFullMonth'))q('yoyFullMonth').textContent=money(a.lyRevenueFullMonth);
    if(q('yoyCoverage'))q('yoyCoverage').textContent=a.lyRevenueFullMonth>0?pctText(a.revenue/a.lyRevenueFullMonth*100):'N/A';
    if(q('yoyModeContext'))q('yoyModeContext').textContent=yoyMode==='lfl'?`${eligible.length} like-for-like store${eligible.length===1?'':'s'}`:`${rows.length} selected store${rows.length===1?'':'s'}`;
    document.querySelectorAll('[data-yoy-mode]').forEach(button=>button.classList.toggle('inactive',button.dataset.yoyMode!==yoyMode));
  }

  function renderTable(rows){
    const body=q('commercialStoreRows');if(!body)return;
    if(!rows.length){body.innerHTML='<tr><td class="commercialEmpty" colspan="9">No stores are available for this scope.</td></tr>';return;}
    body.innerHTML=rows.slice().sort((a,b)=>Number(b.actual.revenue||0)-Number(a.actual.revenue||0)).map(row=>{
      const devices=['iphone','mac','ipad','watch','airpods'].reduce((total,key)=>total+Number(row.actual[key]||0),0);
      const growth=row.lyRevenueSameDate>0?(Number(row.actual.revenue||0)/row.lyRevenueSameDate-1)*100:null;
      const growthText=row.lyRevenueSameDate<=0?'No LY base':row.lyRevenueSameDate<100000?'Low LY base':signedPct(growth);
      return `<tr><td><b>${row.store}</b></td><td class="commercialRate">${pctText(pct(row.iphoneTradeQty,row.actual.iphone))}</td><td class="commercialRate">${pctText(pct(row.macTradeQty,row.actual.mac))}</td><td class="commercialRate">${pctText(pct(row.iphoneLoanQty,row.actual.iphone))}</td><td class="commercialRate">${pctText(pct(row.overallLoanQty,devices))}</td><td class="commercialRate">${pctText(pct(row.iphoneProtectionQty,row.actual.iphone))}</td><td class="commercialRate">${pctText(pct(row.overallProtectionQty,devices))}</td><td>${Math.round(row.microsoftQty||0).toLocaleString('en-IN')}</td><td class="commercialRate">${growthText}</td></tr>`;
    }).join('');
  }

  window.setCommercialYoyMode=function(mode){yoyMode=mode==='lfl'?'lfl':'all';renderCommercialLevers();};
  window.renderCommercialLevers=function(){
    const rows=scopedRows();
    const a=aggregate(rows);
    setMetric('iphoneTradeAttach','iphoneTradeQty',pct(a.iphoneTradeQty,a.iphone),a.iphoneTradeQty);
    setMetric('macTradeAttach','macTradeQty',pct(a.macTradeQty,a.mac),a.macTradeQty);
    setMetric('iphoneLoanAttach','iphoneLoanQty',pct(a.iphoneLoanQty,a.iphone),a.iphoneLoanQty);
    setMetric('overallLoanAttach','overallLoanQty',pct(a.overallLoanQty,a.devices),a.overallLoanQty);
    setMetric('iphoneProtectionAttach','iphoneProtectionQty',pct(a.iphoneProtectionQty,a.iphone),a.iphoneProtectionQty);
    setMetric('overallProtectionAttach','overallProtectionQty',pct(a.overallProtectionQty,a.devices),a.overallProtectionQty);
    if(q('microsoftActualQty'))q('microsoftActualQty').textContent=Math.round(a.microsoftQty).toLocaleString('en-IN');
    if(q('commercialScope'))q('commercialScope').textContent=`${rows.length} store${rows.length===1?'':'s'} · weighted attachment rates`;
    renderYoy(rows);renderTable(rows);
  };

  const priorRefresh=window.refreshV23;
  if(typeof priorRefresh==='function')window.refreshV23=function(){const result=priorRefresh.apply(this,arguments);renderCommercialLevers();return result;};
  const priorNavigate=window.navigateToPage;
  if(typeof priorNavigate==='function')window.navigateToPage=function(page){const result=priorNavigate.apply(this,arguments);if(page==='commercial')renderCommercialLevers();return result;};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(renderCommercialLevers,350));
})();
