(function(){
  'use strict';

  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const visible=node=>!!node&&node.getClientRects().length>0&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden';
  const activePage=()=>document.querySelector('.appPage.active')||document.querySelector('.page.active')||document.querySelector('[id^="page-"]:not([style*="display: none"])');
  const pageName=page=>clean(page?.querySelector('h1,h2')?.textContent||page?.id||'Dashboard');
  const safeName=value=>clean(value).replace(/[^a-z0-9._-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,80)||'report';
  const today=()=>new Date().toISOString().slice(0,10);

  function excelReady(){
    if(window.XLSX?.utils&&window.XLSX?.writeFile)return true;
    window.alert('The Excel download library is still loading. Please wait a moment and try again.');
    return false;
  }

  function uniqueSheetName(workbook,name){
    const base=(clean(name)||'Grid').replace(/[\\/?*\[\]:]/g,' ').slice(0,31)||'Grid';
    let result=base;let index=2;
    while(workbook.SheetNames.includes(result)){const suffix=` ${index++}`;result=base.slice(0,31-suffix.length)+suffix;}
    return result;
  }

  function tableRows(table){
    return Array.from(table.rows).filter(visible).map(row=>Array.from(row.cells).filter(visible).map(cell=>clean(cell.innerText)));
  }

  function addSheet(workbook,name,rows){
    if(!rows.length)return;
    const width=Math.max(...rows.map(row=>row.length),1);
    const sheet=window.XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols']=Array.from({length:width},(_,column)=>({wch:Math.min(42,Math.max(10,...rows.map(row=>clean(row[column]).length+2)))}));
    window.XLSX.utils.book_append_sheet(workbook,sheet,uniqueSheetName(workbook,name));
  }

  function titleForTable(table,index){
    const card=table.closest('.card,.productTableCard,.tableWrap,.weeklyTargetWorkspace,section');
    const title=card?.querySelector('.dataGridHeader h3,.productTableHead h3,h2,h3')?.textContent;
    return clean(title)||`Grid ${index+1}`;
  }

  function selectedFilters(page){
    return Array.from(page.querySelectorAll('select')).filter(visible).map(select=>{
      const label=clean(select.closest('label,.field')?.querySelector('label')?.textContent||select.closest('label')?.childNodes?.[0]?.textContent||select.id||'Filter');
      return [label,clean(select.options[select.selectedIndex]?.textContent||select.value)];
    });
  }

  function summaryRows(page){
    const rows=[['Report',pageName(page)],['Generated',new Date().toLocaleString('en-IN')]];
    const scope=clean(document.querySelector('.roleStrip')?.innerText);
    if(scope)rows.push(['Login scope',scope]);
    for(const [label,value] of selectedFilters(page))rows.push([`Filter · ${label}`,value]);
    rows.push([],["Visible summary","Value","Context"]);
    const selectors=['.dashboardCallouts article','.lobStatusCard','.managementPriorities article','.storeExceptionGrid li','.executiveKpi','.briefKpi','.commercialKpi','.weeklyTargetKpi','.productKpis>div','.productContributionSummary>div','.metric'];
    const seen=new Set();
    page.querySelectorAll(selectors.join(',')).forEach(card=>{
      if(!visible(card)||card.closest('table'))return;
      const label=clean(card.querySelector('h2,h3,h4,span')?.textContent);
      const value=clean(card.querySelector('b,.metric,strong')?.textContent);
      const context=clean(card.querySelector('p,small,.mini')?.textContent);
      const key=`${label}|${value}|${context}`;if(!label||seen.has(key))return;seen.add(key);
      rows.push([label,value,context]);
    });
    return rows;
  }

  function downloadCurrentPage(){
    if(!excelReady())return;
    const page=activePage();if(!page){window.alert('No active dashboard page was found.');return;}
    const workbook=window.XLSX.utils.book_new();
    addSheet(workbook,'Page summary',summaryRows(page));
    Array.from(page.querySelectorAll('table')).filter(visible).forEach((table,index)=>addSheet(workbook,titleForTable(table,index),tableRows(table)));
    window.XLSX.writeFile(workbook,`${safeName(pageName(page))}_${today()}.xlsx`);
  }

  function downloadGrid(table){
    if(!excelReady()||!table)return;
    const title=titleForTable(table,0);const workbook=window.XLSX.utils.book_new();
    addSheet(workbook,title,tableRows(table));
    window.XLSX.writeFile(workbook,`${safeName(title)}_${today()}.xlsx`);
  }

  function ensurePageDownload(){
    if(document.getElementById('reportDownloadBar'))return;
    const anchor=document.querySelector('.roleStrip')||document.querySelector('.topbar');if(!anchor)return;
    const bar=document.createElement('div');bar.className='reportDownloadBar';bar.id='reportDownloadBar';
    bar.innerHTML='<div><strong>Report downloads</strong><span>Exports only the current login scope, active page and selected filters.</span></div><button type="button" class="pageDownloadButton">Download current page</button>';
    bar.querySelector('button').addEventListener('click',downloadCurrentPage);
    anchor.insertAdjacentElement('afterend',bar);
  }

  function exportHost(table){
    const card=table.closest('.card,.productTableCard,.tableWrap,.weeklyTargetWorkspace,section');
    return card?.querySelector(':scope > .dataGridHeader,:scope > .productTableHead,.dataGridHeader,.productTableHead')||null;
  }

  function ensureGridDownloads(){
    document.querySelectorAll('table').forEach((table,index)=>{
      if(table.dataset.gridDownload==='true')return;
      table.dataset.gridDownload='true';
      const button=document.createElement('button');button.type='button';button.className='gridDownloadButton';button.textContent='Download grid';button.setAttribute('aria-label',`Download ${titleForTable(table,index)} as Excel`);
      button.addEventListener('click',()=>downloadGrid(table));
      const host=exportHost(table);
      if(host){host.appendChild(button);return;}
      const bar=document.createElement('div');bar.className='gridExportBar';bar.appendChild(button);
      (table.closest('.tableWrap,.productTableWrap,.trajectoryTableWrap,.weeklyTargetTableWrap')||table).insertAdjacentElement('beforebegin',bar);
    });
  }

  let scheduled=false;
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;ensurePageDownload();ensureGridDownloads();});}
  function init(){ensurePageDownload();ensureGridDownloads();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});}
  window.REPORT_DOWNLOADS_API={downloadCurrentPage,downloadGrid,tableRows,summaryRows};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
