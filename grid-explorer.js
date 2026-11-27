(()=>{
  const states=new WeakMap();
  const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const text=node=>String(node?.textContent||'').replace(/\s+/g,' ').trim();
  const norm=value=>String(value||'').replace(/\s+/g,' ').trim().toLowerCase();
  const rowsFor=table=>Array.from(table.tBodies||[]).flatMap(body=>Array.from(body.rows||[]));
  const headersFor=table=>{
    const row=table.tHead?.rows?.[table.tHead.rows.length-1];
    const width=Math.max(row?.cells?.length||0,...rowsFor(table).map(item=>item.cells.length),0);
    return Array.from({length:width},(_,index)=>text(row?.cells?.[index])||`Column ${index+1}`);
  };
  const isTotalRow=row=>/\btotal\b/i.test(row.className||'')||Array.from(row.cells||[]).slice(0,2).some(cell=>/^total(?:\b|\s|·)/i.test(text(cell)));
  const zeroCell=(cell,header)=>{
    const value=text(cell);if(!value)return false;
    const metricHeader=/achievement|achieved|actual|attach|growth|conversion|target\s*\/\s*achievement|t\s*\/\s*a/i.test(header)||/%/.test(header);
    const plainZero=/^(?:₹\s*)?-?0(?:\.0+)?(?:%|\s*pts?|\s*units?|\s*cr|\s*l)?$/i.test(value);
    const embeddedAchievement=/(?:\bA\s*0\b[^%]{0,18}\b0(?:\.0+)?%|\b(?:achievement|achieved|actual|attach)\s*:?[\s\S]{0,12}\b0(?:\.0+)?%)/i.test(value);
    const percentOnly=/^0(?:\.0+)?%$/.test(value);
    return embeddedAchievement||(metricHeader&&(plainZero||percentOnly));
  };
  function markZeroes(table){
    const headers=headersFor(table);
    rowsFor(table).forEach(row=>{
      let rowZero=false;
      Array.from(row.cells||[]).forEach((cell,index)=>{
        const zero=zeroCell(cell,headers[index]||'');
        cell.classList.toggle('zeroAchievement',zero);
        if(zero){cell.title=cell.title||'Zero achievement requires attention';rowZero=true;}
      });
      row.classList.toggle('zeroAchievementRow',rowZero);
    });
  }
  function option(value,label=value){return `<option value="${esc(value)}">${esc(label)}</option>`;}
  function updateValues(state,reset=false){
    const {table,column,value}=state;const index=Number(column.value);
    if(index<0){value.innerHTML=option('','All values');value.disabled=true;value.dataset.signature='all';return;}
    value.disabled=false;
    const values=[...new Set(rowsFor(table).filter(row=>!isTotalRow(row)).map(row=>text(row.cells[index])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));
    const signature=`${index}|${values.join('\u241f')}`;
    if(value.dataset.signature===signature&&!reset)return;
    const selected=reset?'':value.value;value.innerHTML=option('','All values')+values.map(item=>option(item)).join('');value.value=values.includes(selected)?selected:'';value.dataset.signature=signature;
  }
  function apply(state){
    const {table,search,column,value,mode,count}=state;markZeroes(table);updateValues(state);
    const query=norm(search.value),index=Number(column.value),selected=value.value,zeroMode=mode.value;let visible=0;
    const active=Boolean(query||selected||zeroMode!=='all');
    const rows=rowsFor(table),dataRows=rows.filter(row=>!isTotalRow(row));
    dataRows.forEach(row=>{
      const cells=Array.from(row.cells||[]),haystack=norm(cells.map(text).join(' '));
      const matchesSearch=!query||haystack.includes(query);
      const matchesValue=index<0||!selected||text(cells[index])===selected;
      const hasZero=row.classList.contains('zeroAchievementRow');
      const matchesMode=zeroMode==='all'||(zeroMode==='zero'&&hasZero)||(zeroMode==='nonzero'&&!hasZero);
      const show=matchesSearch&&matchesValue&&matchesMode;row.classList.toggle('gridExplorerHidden',!show);if(show)visible++;
    });
    rows.filter(isTotalRow).forEach(row=>row.classList.toggle('gridExplorerHidden',active));
    const countText=`${visible} of ${dataRows.length} rows${active?' · filtered':''}`;if(count.textContent!==countText)count.textContent=countText;count.classList.toggle('filtering',active);
  }
  function enhance(table,index){
    if(states.has(table)||!table.tBodies?.length||table.dataset.noExplorer)return;
    const headers=headersFor(table);if(!headers.length)return;
    const bar=document.createElement('div');bar.className='gridExplorerBar';bar.dataset.gridExplorer=String(index);bar.setAttribute('aria-label','Grid filters');
    bar.innerHTML=`<label class="gridExplorerField"><span>Search this grid</span><input type="search" placeholder="Type to find rows" aria-label="Search this grid"></label><label class="gridExplorerField"><span>Data point / column</span><select aria-label="Select grid column">${option('-1','All columns')}${headers.map((header,i)=>option(i,header)).join('')}</select></label><label class="gridExplorerField"><span>Value</span><select aria-label="Select grid value"><option value="">All values</option></select></label><label class="gridExplorerField"><span>Achievement status</span><select aria-label="Select achievement status"><option value="all">All rows</option><option value="zero">Zero achievement</option><option value="nonzero">Non-zero achievement</option></select></label><button type="button" class="gridExplorerReset">Reset</button><div class="gridExplorerCount" aria-live="polite"></div>`;
    const [search,column,value,mode]=bar.querySelectorAll('input,select');const reset=bar.querySelector('button'),count=bar.querySelector('.gridExplorerCount');
    const wrapper=table.closest('.tableWrap,.commercialTableWrap,.weeklyTargetTableWrap,.productTableWrap,.trajectoryTableWrap,.recoveryTableWrap,.dqTableWrap')||table.parentElement;wrapper.parentNode.insertBefore(bar,wrapper);
    const state={table,bar,search,column,value,mode,reset,count};states.set(table,state);
    search.addEventListener('input',()=>apply(state));column.addEventListener('change',()=>{updateValues(state,true);apply(state);});value.addEventListener('change',()=>apply(state));mode.addEventListener('change',()=>apply(state));reset.addEventListener('click',()=>{search.value='';column.value='-1';mode.value='all';updateValues(state,true);apply(state);});
    apply(state);
  }
  let scheduled=false;
  function enhanceAll(){scheduled=false;document.querySelectorAll('table').forEach(enhance);states.forEach?.(()=>{});document.querySelectorAll('table').forEach(table=>{const state=states.get(table);if(state)apply(state);});}
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(enhanceAll,40);}
  const observer=new MutationObserver(schedule);
  function init(){enhanceAll();observer.observe(document.body,{childList:true,subtree:true,characterData:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.refreshGridExplorers=schedule;
})();
