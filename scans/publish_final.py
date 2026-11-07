"""Build readable edition without changing the provenance edition."""
from pathlib import Path
import re,json
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'final';OUT.mkdir(exist_ok=True)
parts=[];issues=[];included=[];added=0;fragments=0
for n in range(1,68):
    if n==2:continue # documented duplicate of the first spread
    p=ROOT/'corrected'/f'spread_{n:04d}.txt'
    result=[f'## Скан {n:04d}']
    for line in p.read_text(encoding='utf-8').splitlines():
        if line.startswith('=== PAGE '):
            result+=['', '### '+('Левая страница' if ' L ' in line else 'Правая страница'),'']
            continue
        m=re.match(r'^\[(?:[LR]:\d+|ADD:[LR]:\w+)\]\s*(.*)$',line)
        if not m:continue
        body=m[1]
        if line.startswith('[ADD:'):added+=1
        if '[OCR_FRAGMENT:' in body:
            fragments+=1
            continue
        if 'неразборчиво' in body:
            issues.append({'scan':n,'source_line':line})
            body=re.sub(r'\[неразборчиво:[^\]]*\]','[неразборчиво: загиб страницы]',body)
        result.append(body)
    parts.append('\n'.join(result))
    included.append(n)
intro=('# М. П. Волков\n\n# Античная наука как социокультурное явление. Проблема генезиса\n\n'
       'Ульяновск: УлГТУ, 2008. Электронная версия по сканам.\n\n'
       'Исходные переносы строк сохранены. Повтор первого разворота исключён. '
       'Три повреждённых окончания строк отмечены явно; см. README.md.\n\n')
text=intro+'\n\n---\n\n'.join(parts)+'\n'
(OUT/'Волков — Античная наука.md').write_text(text,encoding='utf-8')
(OUT/'Волков — Античная наука.txt').write_text(text,encoding='utf-8')
manifest={'edition':'final-1','scans_included':included,'duplicate_excluded':'spread_0002.png',
          'restored_additions':added,'excluded_ocr_fragments':fragments,'unreadable_lines':issues,
          'characters':len(text),'source':'../corrected/all_text_corrected.txt'}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert len(included)==66
assert len(issues)==3
assert '[OCR_FRAGMENT:' not in text and '[ADD:' not in text
print(json.dumps({k:v for k,v in manifest.items() if k not in ['scans_included','unreadable_lines']},ensure_ascii=False))
print('VERIFIED',len(included),'scans;',len(issues),'unreadable lines')
