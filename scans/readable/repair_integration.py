from pathlib import Path
import re,json
R=Path(__file__).resolve().parent
p=R/'book_readable.md'
t=p.read_text(encoding='utf-8')
# Correct known, source-confirmed integration mistakes, not hypothetical gaps.
t=re.sub(r'\*\[Пропуск набора: правая страница 117.*?\]\*\s*', '', t, flags=re.S)
t=t.replace('предпола-\n\nволос и т.п., иначе трудно объяснить происхождение этих тканей. Отсюда и признание наличия пустот', 'предполагает признание наличия пустот')
t=re.sub(r'\*\[Пропуск скана: в spread_0041.*?\]\*\s*','',t,flags=re.S)
t=t.replace('знания[^p01-17]\n\n[^p02-1] следует','знания[^p01-17][^p02-1] следует')
t=t.replace('рассматривать\n\nчисло','рассматривать число')
# All introductory footnotes must survive integration.
pilot=(R/'pilot.md').read_text(encoding='utf-8')
for n in range(1,6):
    m=re.search(r'^\*\*\['+str(n)+r'\]\*\* (.*)$',pilot,re.M)
    if not m:raise RuntimeError(f'missing pilot note {n}')
    t=t.replace(f'[{n}]',f'[^intro-{n}]')
    t+=f'\n[^intro-{n}]: {m[1]}\n'
# Audit transparent limitations without pretending OCR-based gaps are missing scans.
qa=json.loads((R/'QA.json').read_text(encoding='utf-8'))
qa['integration_repairs']=['Removed false missing-page statement: spread_0041 has both L/R and 0042 starts at printed p82.','Joined 0059–0060 using corrected L000: предполагает признание наличия пустот. Removed unsupported волос insertion.','Restored all 5 introductory footnote definitions.','Joined кодирования and рассматривать at part boundaries.']
qa['unresolved']=[x for x in qa['unresolved'] if not any(s in x.get('defect','') for s in ['81–82','предпола-','Donne/Shakespeare'])]
refs=re.findall(r'\[\^([^\]]+)\](?!:)',t)
defs=re.findall(r'^\[\^([^\]]+)\]:',t,re.M)
qa['footnotes_verified']={'dangling':sorted(set(refs)-set(defs)),'duplicates':sorted({x for x in defs if defs.count(x)>1}),'definitions':len(defs)}
assert not qa['footnotes_verified']['dangling']
assert not qa['footnotes_verified']['duplicates']
p.write_text(t,encoding='utf-8')
(R/'QA.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(qa['footnotes_verified'],ensure_ascii=False))
