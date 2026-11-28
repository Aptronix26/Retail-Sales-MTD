// Rebuild traffic-data.js from the "Day-wise Traffic" sheet (parsed to JSON by tools/parse_daywise_traffic.py).
// Keeps the dashboard store names / source-only flags from the current file; ARM comes from the sheet.
// Usage: node tools/build_traffic_from_wow.mjs parsed.json
import fs from 'node:fs';import vm from 'node:vm';
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('traffic-data.js','utf8'),ctx);
const OLD=ctx.window.TRAFFIC_INTELLIGENCE;const P=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const key=v=>String(v).toLowerCase().replace(/^aptronix\s+/,'').replace(/[^a-z0-9]+/g,'');
const known=new Map(OLD.rows.map(r=>[key(r.store),r]));const armName=new Map(OLD.rows.map(r=>[r.arm.toLowerCase(),r.arm]));
const dates=[...new Set(P.flatMap(s=>Object.keys(s.daily)))].sort();const start=dates[0],end=dates.at(-1);
const dayIndex=d=>Math.round((Date.parse(d)-Date.parse(start))/864e5);
const rows=[];const changes=[];
for(const s of P){const o=known.get(key(s.store));if(!o)throw new Error(`Unknown store ${s.store}`);const arm=armName.get(String(s.arm).toLowerCase())||String(s.arm);if(arm!==o.arm)changes.push({store:o.store,from:o.arm,to:arm});
  for(const d of dates){const v=s.daily[d];if(v===null||v===undefined||v==='')throw new Error(`Blank ${s.store} ${d}`);rows.push({date:d,week:`W${Math.floor(dayIndex(d)/7)+1}`,arm,store:o.store,traffic:Number(v),sourceOnly:o.sourceOnly});}}
const weeks=[...new Set(rows.map(r=>r.week))].map(w=>{const ds=dates.filter(d=>`W${Math.floor(dayIndex(d)/7)+1}`===w);return {week:w,start:ds[0],end:ds.at(-1),days:ds.length,complete:ds.length===7};});
// validation against the sheet's own week / QTD totals
for(const s of P){const o=known.get(key(s.store));for(const [label,total] of Object.entries(s.weekTotals)){const w=`W${label.match(/\d+/)[0]}`;const sum=rows.filter(r=>r.store===o.store&&r.week===w).reduce((t,r)=>t+r.traffic,0);if(sum!==Number(total))throw new Error(`${o.store} ${w}: ${sum} vs sheet ${total}`);}
  if(s.qtd!=null){const q=rows.filter(r=>r.store===o.store).reduce((t,r)=>t+r.traffic,0);if(q!==Number(s.qtd))throw new Error(`${o.store} QTD ${q} vs ${s.qtd}`);}}
const out={...OLD,version:end,asOfDate:end,periodStart:start,periodEnd:end,weekRanges:weeks,rows,validation:{...OLD.validation,status:'passed',stores:P.length,arms:new Set(rows.map(r=>r.arm)).size,dailyRows:rows.length,armChanges:changes}};
fs.writeFileSync('traffic-data.js',`window.TRAFFIC_INTELLIGENCE=${JSON.stringify(out)};\n`);
console.log(JSON.stringify({asOf:end,weeks:weeks.at(-1),rows:rows.length,armChanges:changes}));
