(function(){
  'use strict';

  const clean=value=>String(value||'').replace(/[🎯💰📊🏃📈💳🔒✍️⚙🗓🏠💬]/gu,'').replace(/\s+/g,' ').trim();

  function enhanceCards(){
    document.querySelectorAll('.executiveKpi,.briefKpi,.commercialKpi').forEach(card=>{
      const label=clean(card.querySelector('h3,span')?.textContent);
      const context=clean(card.querySelector('.mini,small,.commercialBenchmark')?.textContent);
      if(!label||!context)return;
      if(card.dataset.uiEnhanced==='true'){
        const existing=card.querySelector('.ui-hover-tip');
        if(existing&&existing.textContent!==context)existing.textContent=context;
        card.setAttribute('aria-label',label+'. '+context);
        return;
      }
      card.dataset.uiEnhanced='true';
      card.classList.add('ui-interactive-card');
      card.tabIndex=0;
      card.setAttribute('role','group');
      card.setAttribute('aria-label',label+'. '+context);
      const tip=document.createElement('span');
      tip.className='ui-hover-tip';
      tip.setAttribute('aria-hidden','true');
      tip.textContent=context;
      card.appendChild(tip);
    });
  }

  function trackPointer(){
    if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches)return;
    document.addEventListener('pointermove',event=>{
      const surface=event.target.closest('.executiveKpi,.briefKpi,.commercialKpi,.focusPanel,.briefHero');
      if(!surface)return;
      const rect=surface.getBoundingClientRect();
      surface.style.setProperty('--pointer-x',((event.clientX-rect.left)/rect.width*100).toFixed(1)+'%');
      surface.style.setProperty('--pointer-y',((event.clientY-rect.top)/rect.height*100).toFixed(1)+'%');
    },{passive:true});
  }

  function enhanceTables(){
    document.addEventListener('pointerover',event=>{
      const cell=event.target.closest('td');
      if(!cell)return;
      const table=cell.closest('table');
      if(!table)return;
      const row=cell.parentElement;
      row.classList.add('ui-row-hover');
      const index=Array.prototype.indexOf.call(row.children,cell);
      table.querySelectorAll('tbody tr').forEach(item=>item.children[index]?.classList.add('ui-column-hover'));
    });
    document.addEventListener('pointerout',event=>{
      const table=event.target.closest('table');
      if(!table||table.contains(event.relatedTarget))return;
      table.querySelectorAll('.ui-row-hover,.ui-column-hover').forEach(item=>item.classList.remove('ui-row-hover','ui-column-hover'));
    });
  }

  const GRID_HEADERS=[
    {selector:'.executiveKpis',title:'Current-week LOB scorecard',description:'Target, achieved units, achievement rate and remaining gap for each separate LOB in the selected scope.',inside:true},
    {selector:'#commercial .commercialKpis',title:'Commercial attachment summary',description:'Weighted trade-in, loan and AppleCare / license attachment for the selected stores and current reporting period.',inside:true},
    {selector:'#weeklyTargetKpis',title:'Selected-scope target summary',description:'Current week target and achievement shown separately for iPhone, Mac, iPad, Watch and AirPods.',inside:true},
    {selector:'#weeklyTargetWorkspace .weeklyTargetTableWrap',title:'Staff target vs achievement detail',description:'ARM, store and staff-level weekly targets with attributable invoice units for every LOB.'},
    {selector:'#mission .recoveryTableWrap',title:'LOB recovery requirement',description:'Weekly target, achieved units, remaining balance and required daily recovery for each LOB.'},
    {selector:'#trajectory .weekCards',title:'Weekly LOB snapshot cards',description:'Separate achievement snapshots for each completed or current Sunday-to-Saturday week.',inside:true},
    {selector:'#trajectory .trajectoryTableWrap',title:'Weekly LOB trajectory detail',description:'Target, weekly achievement, run rate and projected exit shown independently for every LOB.'},
    {selector:'#product .productAnalysisGrid',title:'Selected product performance breakdown',description:'Sub-LOB/model, ARM and location performance for the active period and product filters.',inside:true},
    {selector:'#admin .mappingSummary',title:'Source mapping summary',description:'Coverage checks for hierarchy stores, matched targets, missing targets, unknown stores and duplicate rows.',inside:true},
    {selector:'#admin .tableWrap',title:'Retail hierarchy mapping',description:'RM, city, ARM and store assignments used to control dashboard scope and login access.'}
  ];

  function ensureGridHeaders(){
    let sequence=0;
    for(const definition of GRID_HEADERS){
      document.querySelectorAll(definition.selector).forEach(target=>{
        if(target.dataset.gridHeader==='true')return;
        target.dataset.gridHeader='true';
        const header=document.createElement('div');
        const id=`data-grid-header-${++sequence}-${Math.random().toString(36).slice(2,7)}`;
        header.className='dataGridHeader';
        header.id=id;
        header.innerHTML=`<div><h3>${definition.title}</h3><p>${definition.description}</p></div><span>Selected scope</span>`;
        target.setAttribute('aria-labelledby',id);
        if(definition.inside)target.insertBefore(header,target.firstChild);
        else target.parentNode?.insertBefore(header,target);
      });
    }
  }

  function addScrollTools(){
    const progress=document.createElement('div');
    progress.className='ui-scroll-progress';
    progress.setAttribute('aria-hidden','true');
    document.body.appendChild(progress);

    const back=document.createElement('button');
    back.className='ui-back-top';
    back.type='button';
    back.setAttribute('aria-label','Back to top');
    back.title='Back to top';
    back.textContent='↑';
    back.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
    document.body.appendChild(back);

    const update=()=>{
      const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
      progress.style.transform='scaleX('+Math.min(1,window.scrollY/max)+')';
      back.classList.toggle('is-visible',window.scrollY>520);
    };
    window.addEventListener('scroll',update,{passive:true});
    update();
  }

  function observeDynamicCards(){
    const observer=new MutationObserver(()=>{enhanceCards();ensureGridHeaders();});
    observer.observe(document.body,{childList:true,characterData:true,subtree:true});
  }

  function init(){
    enhanceCards();
    ensureGridHeaders();
    trackPointer();
    enhanceTables();
    addScrollTools();
    observeDynamicCards();
    document.documentElement.classList.add('ui-polish-ready');
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
