import openpyxl,json,datetime,sys
wb=openpyxl.load_workbook(sys.argv[1],read_only=True,data_only=True)
ws=wb['Day-wise Traffic']; ws.reset_dimensions(); rows=list(ws.iter_rows(values_only=True))
hdr1,hdr2=rows[1],rows[2]
datecols=[(i,v.date().isoformat()) for i,v in enumerate(hdr2) if isinstance(v,datetime.datetime)]
weektot=[(i,str(v)) for i,v in enumerate(hdr1) if isinstance(v,str) and 'Total' in v]
out=[];arm=None;meta=[]
for r in rows[3:]:
    if not any(c not in (None,'') for c in r): continue
    a,b=r[0],r[1]
    if a and str(a).strip(): arm=str(a).strip()
    if not b: meta.append([str(x) for x in r[:3]]+['...']); continue
    name=str(b).strip()
    if 'total' in name.lower() or 'total' in str(a or '').lower(): meta.append([str(a),name]); continue
    vals={d:r[i] for i,d in datecols}
    wk={lab:r[i] for i,lab in weektot}
    out.append({'arm':arm,'store':name,'daily':vals,'weekTotals':wk,'qtd':r[len(hdr1)-1] if len(r)>=len(hdr1) else None})
print(json.dumps({'dates':[d for _,d in datecols][:2]+[d for _,d in datecols][-3:],'ndates':len(datecols),'weekTotalCols':[l for _,l in weektot],'stores':len(out),'meta':meta[:12],'lastHeader':hdr1[-4:]},indent=0,default=str))
json.dump(out,open('ff_parsed.json','w'),default=str)
