from pathlib import Path
import json,re,difflib
ROOT=Path(__file__).resolve().parent
rows=[]
for p in sorted((ROOT/'corrected').glob('spread_*.txt')):
    source=json.loads((ROOT/'layout'/(p.stem+'.json')).read_text(encoding='utf-8'))
    original={line['id']:line for line in source['lines']}
    parsed=[(m.group(1),int(m.group(2)),m.group(3)) for m in re.finditer(r'^\[([LR]):(\d+)\](.*)$',p.read_text(encoding='utf-8'),re.M)]
    ids=[x[1] for x in parsed]
    assert set(ids)==set(original) and len(ids)==len(original), p.name
    changed=0;suspicious=[]
    for side,i,text in parsed:
        raw=original[i]['text'].strip();text=text.strip()
        if raw!=text:changed+=1
        similarity=difflib.SequenceMatcher(None,raw,text,autojunk=False).ratio()
        if similarity<.55 and len(raw)>15:
            suspicious.append({'id':i,'raw':raw,'corrected':text,'similarity':round(similarity,3)})
    rows.append({'file':p.name,'lines':len(ids),'changed_lines':changed,'suspicious':suspicious})
output={'files':len(rows),'lines':sum(x['lines'] for x in rows),'changed_lines':sum(x['changed_lines'] for x in rows),'details':rows}
(ROOT/'correction_audit.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in output.items() if k!='details'},ensure_ascii=False))
for row in rows:
    if row['suspicious']:print(row['file'],json.dumps(row['suspicious'],ensure_ascii=False))
