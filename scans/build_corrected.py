"""Validate corrected line inventory and build provenance-preserving text."""
from pathlib import Path
import json,re,difflib
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'corrected'
records=[];combined=[]
for number in range(1,68):
    name=f'spread_{number:04d}'
    layout=json.loads((ROOT/'layout'/f'{name}.json').read_text(encoding='utf-8'))
    text=(OUT/f'{name}.txt').read_text(encoding='utf-8')
    entries=list(re.finditer(r'^\[([LR]):(\d+)\](.*)$',text,re.M))
    ids=[int(m[2]) for m in entries]
    original={int(line['id']):line['text'] for line in layout['lines']}
    assert set(ids)==set(original) and len(ids)==len(original),name
    assert text.count('=== PAGE L ===')==text.count('=== PAGE R ===')==1,name
    changed=sum(m[3].strip()!=original[int(m[2])].strip() for m in entries)
    records.append({'file':name+'.txt','lines':len(ids),'changed_lines':changed,
                    'uncertainty_markers':text.count('[неуверенно:')+text.count('AMBIGUOUS')})
    combined.append(text.strip())
manifest={'model':'cursor/grok-4.7@500k','method':'Parallel OCR proofreading; selective image checks, not exhaustive facsimile verification',
          'files':len(records),'lines':sum(r['lines'] for r in records),
          'changed_lines':sum(r['changed_lines'] for r in records),'records':records}
(OUT/'all_text_corrected.txt').write_text('\n\n\f\n\n'.join(combined)+'\n',encoding='utf-8')
(OUT/'validation.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in manifest.items() if k!='records'},ensure_ascii=False))
