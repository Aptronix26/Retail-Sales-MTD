// Rebuilds day-wise store net revenue from the daily snapshots of sales-achievements.js
// kept in git history (one snapshot per morning). daily(store, d) = cumulative week revenue
// as of d minus cumulative as of d-1 (same week). Complete weeks are reconciled to the
// latest weekly totals so daily sums always equal the published week figures.
// Usage: node tools/build_daily_revenue.mjs  (run from repo root with enough git history)
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import vm from 'node:vm';

const sh=cmd=>execSync(cmd,{encoding:'utf8',maxBuffer:1<<30});
const load=src=>{const ctx={window:{}};vm.createContext(ctx);vm.runInContext(src,ctx);return ctx.window.WEEKLY_STAFF_ACHIEVEMENTS;};
const commits=sh('git log --format=%H -- sales-achievements.js').trim().split('\n');
const byDate=new Map(); // asOfDate -> data (latest commit wins; log is newest first)
for(const c of commits){
  let data;try{data=load(sh(`git show ${c}:sales-achievements.js`));}catch{continue;}
  if(!data?.asOfDate||!Array.isArray(data.commercialByStoreWeek)||!data.commercialByStoreWeek.length)continue;
  if(!byDate.has(data.asOfDate))byDate.set(data.asOfDate,data);
}
const dates=[...byDate.keys()].sort();
const latest=byDate.get(dates.at(-1));
const weeks=latest.weekRanges;
const weekOf=d=>Object.entries(weeks).find(([,r])=>d>=r.start&&d<=r.end)?.[0];
const prevDay=d=>{const t=new Date(`${d}T00:00:00Z`);t.setUTCDate(t.getUTCDate()-1);return t.toISOString().slice(0,10);};
const cum=(data,store,week)=>data?(data.commercialByStoreWeek.filter(r=>r.store===store&&r.week===week).reduce((s,r)=>s+(Number(r.netRevenue)||0),0)):null;
// contiguous coverage only: start = first date whose previous day is the week start - 1 or also covered
let start=null;for(const d of dates){const w=weekOf(d);if(!w)continue;if(d===weeks[w].start||byDate.has(prevDay(d))){start??=d;}else{start=null;}}
const covered=dates.filter(d=>d>=start&&weekOf(d));
// only keep weeks whose first day is covered
const stores=[...new Set(latest.commercialByStoreWeek.map(r=>r.store))].sort();
const rows=[];const recon=[];
const weekIds=[...new Set(covered.map(weekOf))].filter(w=>covered.includes(weeks[w].start));
for(const w of weekIds){
  const days=covered.filter(d=>weekOf(d)===w);
  for(const store of stores){
    const raw=days.map(d=>{const today=cum(byDate.get(d),store,w)||0;const before=d===weeks[w].start?0:(cum(byDate.get(prevDay(d)),store,w)||0);return today-before;});
    const rawTotal=raw.reduce((a,b)=>a+b,0);const final=cum(latest,store,w)||0;
    const lastDay=days.at(-1);const weekDone=lastDay===weeks[w].end&&lastDay!==dates.at(-1);
    let adj=raw.slice();
    if(Math.abs(final-rawTotal)>0.5){adj[adj.length-1]+=final-rawTotal;recon.push({store,week:w,snapshot:Math.round(rawTotal),final:Math.round(final),correctionOnLastDay:Math.round(final-rawTotal)});}
    days.forEach((d,i)=>{if(adj[i]!==0)rows.push({date:d,week:w,store,netRevenue:Math.round(adj[i]*100)/100});});
  }
}
const out={version:latest.asOfDate,source:'Daily snapshots of sales-achievements.js (Sales Invoice Statement), git history',coverageStart:covered[0],coverageEnd:covered.at(-1),weeks:weekIds,method:'Day = cumulative store-week net revenue as of that morning minus the previous morning. Late corrections booked to a week after its days were reported are added to that week\'s last covered day so every week total equals the published weekly figure.',reconciliation:recon,rows};
fs.writeFileSync('store-daily-revenue.js',`window.STORE_DAILY_REVENUE=${JSON.stringify(out)};\n`);
console.log(JSON.stringify({coverage:[out.coverageStart,out.coverageEnd],weeks:weekIds,rows:rows.length,stores:stores.length,corrections:recon.length,snapshotDates:dates},null,1));
