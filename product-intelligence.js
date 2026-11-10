(function(){
  const SALES=window.WEEKLY_STAFF_ACHIEVEMENTS;
  const RAW=SALES?.productByStoreWeek||[];
  const LOBS=['iPhone','Mac','iPad','Watch','AirPods'];
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const num=value=>Number.isFinite(Number(value))?Number(value):0;
  const sum=(rows,key)=>rows.reduce((total,row)=>total+num(row[key]),0);
  const fmt=value=>Math.round(num(value)).toLocaleString('en-IN');
  const money=value=>`₹${Math.round(num(value)).toLocaleString('en-IN')}`;
  const compactMoney=value=>{const amount=num(value);if(Math.abs(amount)>=10000000)return `₹${(amount/10000000).toFixed(2)} Cr`;if(Math.abs(amount)>=100000)return `₹${(amount/100000).toFixed(1)} L`;return money(amount);};
  const pct=value=>`${num(value).toFixed(1)}%`;
  const cleanStore=value=>String(value||'').replace(/^Aptronix\s+/i,'');
  const productLabel=value=>String(value||'').replace(/^IPHONE\b/,'iPhone').replace(/^IPAD\b/,'iPad').replace(/^AIRPODS\b/,'AirPods');
  const storeMap=()=>new Map((window.STORE_MAP||[]).map(row=>[row.store,row]));
  const currentUser=()=>typeof CURRENT_USER!=='undefined'?CURRENT_USER:null;
  const roleHasNetwork=role=>['RM','Admin / HO','HO','CEO','Business Head'].includes(role);
  let activeRows=[];

  function accessibleStores(){
    const user=currentUser();
    const rows=window.STORE_MAP||[];
    if(!user)return [];
    if(roleHasNetwork(user.role))return rows;
    if(user.role==='ARM')return rows.filter(row=>row.arm===user.user);
    if(user.role==='Store Manager'||user.role==='Staff')return rows.filter(row=>row.store===user.user);
    return [];
  }

  function option(value,label){return `<option value="${esc(value)}">${esc(label??value)}</option>`;}
  function setOptions(id,values,allLabel){
    const select=document.getElementById(id);if(!select)return '';
    const prior=select.value;
    const unique=[...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
    select.innerHTML=option('All',allLabel)+unique.map(value=>option(value,id==='productSubLob'?productLabel(value):id==='productStore'?cleanStore(value):value)).join('');
    select.value=prior==='All'||unique.includes(prior)?prior:'All';
    return select.value;
  }
  function value(id){return document.getElementById(id)?.value||'All';}
  function selected(valueToTest,selectedValue){return selectedValue==='All'||valueToTest===selectedValue;}

  function refreshDimensions(changed){
    const maps=accessibleStores();
    const allowed=new Set(maps.map(row=>row.store));
    const weeks=[...new Set(RAW.filter(row=>allowed.has(row.store)).map(row=>row.week))].sort((a,b)=>Number(a.slice(1))-Number(b.slice(1)));
    const weekSelect=document.getElementById('productWeek');
    if(weekSelect&&!weekSelect.options.length){
      const firstStart=SALES.weekRanges?.[weeks[0]]?.start||'2026-09-27';
      weekSelect.innerHTML=option('QTD',`Quarter to date · ${firstStart} to ${SALES.asOfDate}`)+weeks.map(week=>option(week,`${week.replace('W','Week ')} · ${SALES.weekRanges?.[week]?.start||''} to ${SALES.weekRanges?.[week]?.end||''}`)).join('');
      weekSelect.value='QTD';
    }
    let lob=setOptions('productLob',LOBS,'All LOBs');
    if(['build','reset'].includes(changed)){document.getElementById('productLob').value='iPhone';lob='iPhone';}
    const period=value('productWeek');
    const subBase=RAW.filter(row=>allowed.has(row.store)&&(period==='QTD'||row.week===period)&&selected(row.lob,lob));
    if(changed==='lob'||changed==='week')document.getElementById('productSubLob').value='All';
    setOptions('productSubLob',subBase.map(row=>row.subLob),'All sub-LOBs');

    const rm=setOptions('productRm',maps.map(row=>row.rm),'All RMs');
    const armBase=maps.filter(row=>selected(row.rm,rm));
    if(changed==='rm')document.getElementById('productArm').value='All';
    const arm=setOptions('productArm',armBase.map(row=>row.arm),'All ARMs');
    const locationBase=RAW.filter(row=>allowed.has(row.store)&&selected(storeMap().get(row.store)?.rm,rm)&&selected(storeMap().get(row.store)?.arm,arm));
    if(changed==='rm'||changed==='arm')document.getElementById('productLocation').value='All';
    const location=setOptions('productLocation',locationBase.map(row=>row.location),'All locations');
    const storeBase=maps.filter(row=>selected(row.rm,rm)&&selected(row.arm,arm)).filter(row=>{
      if(location==='All')return true;
      return RAW.some(product=>product.store===row.store&&product.location===location);
    });
    if(['rm','arm','location'].includes(changed))document.getElementById('productStore').value='All';
    setOptions('productStore',storeBase.map(row=>row.store),'All stores');
    render();
  }

  function enrichedRows(){
    const map=storeMap();
    const allowed=new Set(accessibleStores().map(row=>row.store));
    return RAW.filter(row=>allowed.has(row.store)).map(row=>({...row,...(map.get(row.store)||{})}));
  }

  function filteredRows(ignoreSubLob=false){
    const filters={week:value('productWeek'),lob:value('productLob'),subLob:value('productSubLob'),rm:value('productRm'),arm:value('productArm'),location:value('productLocation'),store:value('productStore')};
    return enrichedRows().filter(row=>(filters.week==='QTD'||row.week===filters.week)&&selected(row.lob,filters.lob)&&(ignoreSubLob||selected(row.subLob,filters.subLob))&&selected(row.rm,filters.rm)&&selected(row.arm,filters.arm)&&selected(row.location,filters.location)&&selected(row.store,filters.store));
  }

  function group(rows,keyFn){
    const groups=new Map();
    for(const row of rows){
      const key=keyFn(row);const current=groups.get(key)||{key,units:0,revenue:0,grossProfit:0,discount:0,stores:new Set()};
      current.units+=num(row.units);current.revenue+=num(row.revenue);current.grossProfit+=num(row.grossProfit);current.discount+=num(row.discount);current.stores.add(row.store);groups.set(key,current);
    }
    return [...groups.values()].sort((a,b)=>b.units-a.units||b.revenue-a.revenue);
  }

  function bars(rows,emptyText){
    if(!rows.length)return `<div class="productEmpty">${esc(emptyText)}</div>`;
    const max=Math.max(...rows.map(row=>Math.max(0,row.units)),1);
    return `<div class="productBars">${rows.slice(0,10).map(row=>`<div class="productBarRow"><span title="${esc(productLabel(row.key))}">${esc(productLabel(row.key))}</span><div><i style="width:${Math.max(2,Math.max(0,row.units)/max*100)}%"></i></div><b>${fmt(row.units)} units</b></div>`).join('')}</div>`;
  }

  function render(){
    const root=document.getElementById('productIntelligenceRoot');if(!root)return;
    const rows=filteredRows();activeRows=rows;
    const units=sum(rows,'units');const revenue=sum(rows,'revenue');const gp=sum(rows,'grossProfit');
    const stores=new Set(rows.filter(row=>num(row.units)>0).map(row=>row.store)).size;
    const baseUnits=sum(filteredRows(true),'units');const mix=baseUnits?units/baseUnits*100:0;
    const selectedLob=value('productLob');const selectedSub=value('productSubLob');const selectedStore=value('productStore');
    const scope=[selectedLob==='All'?'All LOBs':selectedLob,selectedSub==='All'?'All sub-LOBs':productLabel(selectedSub),selectedStore==='All'?'All stores':cleanStore(selectedStore)].join(' · ');
    document.getElementById('productScopeReadout').textContent=`${scope} · ${value('productWeek')==='QTD'?'Quarter to date from 27 Sep':value('productWeek')} · through ${SALES.asOfDate}`;
    document.getElementById('productKpis').innerHTML=`
      <div><span>Sales achievement</span><b>${fmt(units)} units</b><small>Net invoice quantity</small></div>
      <div><span>Net revenue</span><b>${compactMoney(revenue)}</b><small>Selected product scope</small></div>
      <div><span>Average selling price</span><b>${units?money(revenue/units):'—'}</b><small>Revenue ÷ units</small></div>
      <div><span>Stores selling</span><b>${fmt(stores)}</b><small>Positive unit sales</small></div>
      <div><span>Gross margin</span><b>${revenue?pct(gp/revenue*100):'—'}</b><small>${compactMoney(gp)} gross profit</small></div>
      <div><span>Selected mix</span><b>${baseUnits?pct(mix):'—'}</b><small>Share within current LOB scope</small></div>`;

    document.getElementById('productSubLobBars').innerHTML=bars(group(rows,row=>row.subLob),'No sub-LOB sales match this selection.');
    document.getElementById('productArmBars').innerHTML=bars(group(rows,row=>row.arm||'Unmapped ARM'),'No ARM sales match this selection.');
    document.getElementById('productLocationBars').innerHTML=bars(group(rows,row=>row.location||'Unmapped'),'No location sales match this selection.');

    const storeRows=group(rows,row=>row.store).map(grouped=>{
      const first=rows.find(row=>row.store===grouped.key)||{};
      return {...grouped,rm:first.rm||'—',arm:first.arm||'—',location:first.location||'—'};
    });
    document.getElementById('productStoreRows').innerHTML=storeRows.length?storeRows.map(row=>`<tr><td><b>${esc(cleanStore(row.key))}</b></td><td>${esc(row.location)}</td><td>${esc(row.arm)}</td><td>${fmt(row.units)}</td><td>${money(row.revenue)}</td><td>${row.units?money(row.revenue/row.units):'—'}</td><td>${row.revenue?pct(row.grossProfit/row.revenue*100):'—'}</td></tr>`).join(''):`<tr><td colspan="7" class="productEmpty">No sales match this selection.</td></tr>`;

    const detail=group(rows,row=>`${row.lob}\u241f${row.subLob}\u241f${row.store}`).map(grouped=>{
      const [lob,subLob,store]=grouped.key.split('\u241f');const first=rows.find(row=>row.lob===lob&&row.subLob===subLob&&row.store===store)||{};
      return {...grouped,lob,subLob,store,location:first.location||'—',arm:first.arm||'—'};
    });
    document.getElementById('productDetailRows').innerHTML=detail.length?detail.slice(0,200).map(row=>`<tr><td>${esc(row.lob)}</td><td><b>${esc(productLabel(row.subLob))}</b></td><td>${esc(cleanStore(row.store))}</td><td>${esc(row.location)}</td><td>${esc(row.arm)}</td><td>${fmt(row.units)}</td><td>${money(row.revenue)}</td><td>${row.units?money(row.revenue/row.units):'—'}</td></tr>`).join(''):`<tr><td colspan="8" class="productEmpty">No detailed rows match this selection.</td></tr>`;
  }

  function csvCell(value){const text=String(value??'');return /[",\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;}
  window.downloadProductIntelligence=function(){
    const rows=filteredRows();const map=storeMap();
    const header=['Week','LOB','Sub-LOB','RM','ARM','Location','Store','Units','Revenue','Gross Profit','Discount'];
    const lines=[header,...rows.map(row=>[row.week,row.lob,row.subLob,map.get(row.store)?.rm||'',map.get(row.store)?.arm||'',row.location,row.store,row.units,row.revenue,row.grossProfit,row.discount])].map(row=>row.map(csvCell).join(','));
    const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`Product_Intelligence_${value('productWeek')}.csv`;link.click();URL.revokeObjectURL(link.href);
  };

  function reset(){
    ['productLob','productSubLob','productRm','productArm','productLocation','productStore'].forEach(id=>{const node=document.getElementById(id);if(node)node.value='All';});
    refreshDimensions('reset');
  }

  function build(){
    const root=document.getElementById('productIntelligenceRoot');if(!root||root.dataset.ready)return;root.dataset.ready='true';
    root.innerHTML=`<div class="productHeader"><div><h2>🔎 Product Intelligence</h2><p>Analyse verified unit sales, revenue and mix by LOB, sub-LOB/model, RM, ARM, location and store.</p></div><div><button class="light" id="productReset">Reset</button><button id="productExport">Export current view</button></div></div>
      <div class="productFilters">
        <label>Period<select id="productWeek"></select></label><label>LOB<select id="productLob"></select></label><label>Sub-LOB / model<select id="productSubLob"></select></label>
        <label>RM<select id="productRm"></select></label><label>ARM<select id="productArm"></select></label><label>Location<select id="productLocation"></select></label><label>Store<select id="productStore"></select></label>
      </div>
      <div class="productScopeReadout" id="productScopeReadout"></div><div class="productDefinition"><b>Achievement on this page means actual net sales.</b> LOB, ARM, location and store results can be filtered for QTD or a selected week. Sub-LOB/model actuals are available, but sub-LOB target achievement % is not calculated because the target source has no model-level targets.</div><div class="productKpis" id="productKpis"></div>
      <div class="productAnalysisGrid"><div class="card"><h3>Sub-LOB / model mix</h3><div id="productSubLobBars"></div></div><div class="card"><h3>ARM performance</h3><div id="productArmBars"></div></div><div class="card"><h3>Location performance</h3><div id="productLocationBars"></div></div></div>
      <div class="card productTableCard"><div class="productTableHead"><div><h3>Store performance</h3><p>Exact store-level results for the selected product scope.</p></div></div><div class="productTableWrap"><table><thead><tr><th>Store</th><th>Location</th><th>ARM</th><th>Units</th><th>Revenue</th><th>ASP</th><th>GP %</th></tr></thead><tbody id="productStoreRows"></tbody></table></div></div>
      <div class="card productTableCard"><div class="productTableHead"><div><h3>Detailed product records</h3><p>LOB × sub-LOB × store; up to 200 rows shown. Export retains the full filtered result.</p></div></div><div class="productTableWrap"><table><thead><tr><th>LOB</th><th>Sub-LOB / model</th><th>Store</th><th>Location</th><th>ARM</th><th>Units</th><th>Revenue</th><th>ASP</th></tr></thead><tbody id="productDetailRows"></tbody></table></div></div>
      <div class="productMethod">Source: verified POS and Sale Return invoice rows from 27 Sep through ${esc(SALES?.asOfDate||'—')}. Cancelled/held transactions, non-target stores and categories outside iPhone, Mac, iPad, Watch and AirPods are excluded.</div>`;
    document.getElementById('productWeek').addEventListener('change',()=>refreshDimensions('week'));
    document.getElementById('productLob').addEventListener('change',()=>refreshDimensions('lob'));
    document.getElementById('productSubLob').addEventListener('change',render);
    document.getElementById('productRm').addEventListener('change',()=>refreshDimensions('rm'));
    document.getElementById('productArm').addEventListener('change',()=>refreshDimensions('arm'));
    document.getElementById('productLocation').addEventListener('change',()=>refreshDimensions('location'));
    document.getElementById('productStore').addEventListener('change',render);
    document.getElementById('productReset').addEventListener('click',reset);
    document.getElementById('productExport').addEventListener('click',window.downloadProductIntelligence);
    refreshDimensions('build');
    const login=window.retailLogin2454;if(typeof login==='function'&&!login.productWrapped){const wrapped=function(){const ok=login.apply(this,arguments);if(ok)setTimeout(()=>refreshDimensions('login'),0);return ok;};wrapped.productWrapped=true;window.retailLogin2454=wrapped;window.employeeLoginApp=wrapped;window.loginApp=wrapped;}
  }
  window.PRODUCT_INTELLIGENCE_API={render,refreshDimensions,filteredRows};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
