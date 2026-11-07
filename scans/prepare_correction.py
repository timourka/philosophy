from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'corrected'
OUT.mkdir(exist_ok=True)
rows=[]
for p in sorted((ROOT/'layout').glob('spread_*.json')):
    data=json.loads(p.read_text(encoding='utf-8'))
    pages={'L':[],'R':[]}
    for line in data['lines']:
        words=line['words']
        x=min(w['x'] for w in words)
        end=max(w['x']+w['width'] for w in words)
        y=min(w['y'] for w in words)
        side='L' if (x+end)/2 < data['width']*.53 else 'R'
        pages[side].append((y,x,line))
    content=['# '+data['source'], '# Сохранены исходные строки; L/R — геометрическая оценка стороны разворота.']
    for side in ['L','R']:
        content+=['',f'=== PAGE {side} ===']
        for y,x,line in sorted(pages[side],key=lambda t:(t[0],t[1])):
            content.append(f"[{side}:{line['id']:03d}] {line['text']}")
    dest=OUT/(p.stem+'.txt')
    if dest.exists(): raise RuntimeError('Refusing overwrite '+str(dest))
    dest.write_text('\n'.join(content)+'\n',encoding='utf-8')
    rows.append({'source':data['source'],'file':dest.name,'lines':len(data['lines'])})
(ROOT/'correction_input_manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print('PREPARED',len(rows),'FILES',sum(x['lines'] for x in rows),'LINES')
