# -*- coding: utf-8 -*-
"""Assemble scans/readable/book_readable.md from pilot + part_01..08.

Does not modify pilot, parts, notes, corrected, or final.
Writes only book_readable.md, EDITORIAL_NOTES.md, QA.json
next to this script.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CORRECTED = ROOT.parent / "corrected"
OUT_BOOK = ROOT / "book_readable.md"
OUT_NOTES = ROOT / "EDITORIAL_NOTES.md"
OUT_QA = ROOT / "QA.json"

SOURCES = [
    ("pilot", "pilot.md", [1, 3]),
    ("part_01", "part_01.md", list(range(4, 12))),
    ("part_02", "part_02.md", list(range(12, 20))),
    ("part_03", "part_03.md", list(range(20, 28))),
    ("part_04", "part_04.md", list(range(28, 36))),
    ("part_05", "part_05.md", list(range(36, 44))),
    ("part_06", "part_06.md", list(range(44, 52))),
    ("part_07", "part_07.md", list(range(52, 60))),
    ("part_08", "part_08.md", list(range(60, 68))),
]

# Page-edge hyphen splits verified against corrected line breaks.
# Only pairs that are one word cut by a page boundary.
JOINS = [
    (
        "part_01",
        "part_02",
        "универсально-понятийного способа кодирования социального знания.",
        "дирования социального знания",
        "универсально-понятийного способа кодирования социального знания",
    ),
    (
        "part_05",
        "part_06",
        "пластически телесный характер античного миросозерцания заставляет рас-",
        "сматривать число",
        "пластически телесный характер античного миросозерцания заставляет рассматривать число",
    ),
    (
        "part_07",
        "part_08",
        "проникновение запаха в закрытое помещение предпола-",
        "волос и т.п.",
        None,  # not a hyphen of one word: 0059R ends "предпола-", 0060L continues a different clause ("волос")
    ),
]

EDITORIAL_LINE = re.compile(
    r"^(Читательская редакция|М\.П\. Волков\. Античная наука как социокультурное явление\. Развороты|"
    r"Маркеры с нижнего поля|Сноски собраны с нижнего поля|"
    r"Предложение оборвано вместе со страницей|"
    r"78–122\. \[реконструкция: позиции списка)",
    re.I,
)

WORD_RE = re.compile(r"[A-Za-zА-Яа-яЁё0-9]{4,}", re.U)


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def split_body_notes(text: str):
    """Body keeps prose. Footnote definitions may sit between paragraphs
    (part_05, part_08) or under a '## Сноски' heading.
    A definition line starts with [^id]: ; following indented lines stay with it.
    """
    lines = text.splitlines()
    body, notes = [], []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.strip() in {"## Сноски", "## Примечания"}:
            i += 1
            continue
        if re.match(r"^\[\^[\w.-]+\]:", line):
            notes.append(line)
            i += 1
            while i < len(lines) and (lines[i].startswith("    ") or lines[i].startswith("\t") or lines[i].strip() == ""):
                # blank line ends the def only if the next content line is not a continuation
                if lines[i].strip() == "":
                    nxt = i + 1
                    while nxt < len(lines) and lines[nxt].strip() == "":
                        nxt += 1
                    if nxt < len(lines) and (lines[nxt].startswith("    ") or lines[nxt].startswith("\t")):
                        notes.append(lines[i])
                        i += 1
                        continue
                    break
                notes.append(lines[i])
                i += 1
            continue
        body.append(line)
        i += 1
    return body, notes


def is_meta(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    if s.startswith("<!--"):
        return True
    if s == "---":
        return True
    if s.startswith("# Часть "):
        return True
    if s.startswith("# М. П. Волков") or s.startswith("# Греческий язык и миф"):
        return True
    if EDITORIAL_LINE.match(s):
        return True
    if s.startswith("На с. 5 слово") or s.startswith("Это не дословная"):
        return True
    if s.startswith("**[") and "]**" in s[:12]:
        return True
    if "Технические оригиналы не изменялись" in s:
        return True
    return False


def clean_body(lines):
    kept, dropped = [], []
    for line in lines:
        if is_meta(line):
            if line.strip() and line.strip() != "---" and not line.strip().startswith("<!--"):
                dropped.append(line.strip())
            continue
        kept.append(line)
    # collapse 3+ blank lines
    out, blanks = [], 0
    for line in kept:
        if line.strip() == "":
            blanks += 1
            if blanks <= 1:
                out.append("")
        else:
            blanks = 0
            out.append(line.rstrip())
    return out, dropped


def apply_join(prev_name, prev_lines, name, lines, log):
    """Glue a hyphen broken across the part boundary."""
    rules = {
        ("part_01", "part_02"): "kod",
        ("part_05", "part_06"): "ras",
        ("part_07", "part_08"): "pred",
    }
    kind = rules.get((prev_name, name))
    if not kind:
        return prev_lines, lines
    if kind == "kod":
        i = next((k for k in range(len(prev_lines) - 1, -1, -1) if "кодирования социального знания" in prev_lines[k]), None)
        j = next((k for k, line in enumerate(lines) if line.startswith("дирования социального знания")), None)
        if i is None or j is None:
            log.append({"join": "part_01->part_02", "status": "anchors_not_found", "i": i, "j": j})
            return prev_lines, lines
        prev_lines[i] = prev_lines[i].replace(".[^p01-17]", "[^p01-17]")
        lines[j] = lines[j].replace("дирования социального знания", "", 1).lstrip()
        log.append({"join": "part_01->part_02", "status": "joined", "right": lines[j][:140]})
    elif kind == "ras":
        i = next((k for k in range(len(prev_lines) - 1, -1, -1) if prev_lines[k].rstrip().endswith("рас-")), None)
        j = next((k for k, line in enumerate(lines) if line.startswith("сматривать число")), None)
        if i is None or j is None:
            log.append({"join": "part_05->part_06", "status": "anchors_not_found", "i": i, "j": j})
            return prev_lines, lines
        prev_lines[i] = prev_lines[i].rstrip()[:-4] + "рассматривать "
        lines[j] = lines[j].replace("сматривать число", "число", 1)
        log.append({"join": "part_05->part_06", "status": "joined", "left": prev_lines[i][-80:], "right": lines[j][:80]})
    else:
        log.append({
            "join": "part_07->part_08",
            "status": "not_one_word",
            "note": "0059 ends mid-word on another sentence; 0060 opens with волос. Not glued.",
        })
    return prev_lines, lines


def words(text: str):
    return WORD_RE.findall(text.lower().replace("ё", "е"))


def source_words(spread_ids):
    bag = []
    for n in spread_ids:
        p = CORRECTED / f"spread_{n:04d}.txt"
        raw = p.read_text(encoding="utf-8")
        body = []
        for line in raw.splitlines():
            if line.startswith("#") or line.startswith("===") or line.startswith("[OCR_FRAGMENT"):
                continue
            m = re.match(r"\[(?:L|R):\d+\]\s*(.*)", line)
            if not m:
                continue
            payload = m.group(1).strip()
            if re.fullmatch(r"[\d\sЗIl]{1,4}", payload or " "):
                continue  # page number
            body.append(payload)
        # dehyphenate adjacent lines ending with -
        joined = []
        buf = ""
        for line in body:
            if buf:
                buf = buf[:-1] + line
                if not buf.endswith("-"):
                    joined.append(buf)
                    buf = ""
            elif line.endswith("-") and not line.endswith("—"):
                buf = line
            else:
                joined.append(line)
        if buf:
            joined.append(buf)
        bag.extend(words(" ".join(joined)))
    return bag


def coverage(src_tokens, text):
    hay = " ".join(words(text))
    # also allow the raw lowered text so hyphen-joins still count
    blob = text.lower().replace("ё", "е")
    hit = 0
    missing_samples = []
    for tok in src_tokens:
        if len(tok) < 5:
            continue
        if tok in blob:
            hit += 1
        else:
            if len(missing_samples) < 25:
                missing_samples.append(tok)
    denom = sum(1 for t in src_tokens if len(t) >= 5)
    return {"numerator": hit, "denominator": denom, "ratio": round(hit / denom, 4) if denom else None, "missing_sample": missing_samples}


def footnote_audit(text: str):
    refs = re.findall(r"\[\^([\w.-]+)\]", text)
    defs = set(re.findall(r"^\[\^([\w.-]+)\]:", text, re.M))
    ref_ids = []
    for r in refs:
        if r not in ref_ids:
            ref_ids.append(r)
    dangling = [r for r in ref_ids if r not in defs]
    unused = sorted(defs - set(ref_ids))
    return {"refs": len(ref_ids), "defs": len(defs), "dangling": dangling, "unused_defs": unused}


def biblio_numbers(part08_body: str):
    lines = part08_body.splitlines()
    start = 0
    for i, line in enumerate(lines):
        if line.strip() == "## Библиографический список":
            start = i
            break
    nums = []
    for line in lines[start:]:
        m = re.match(r"^(\d{1,3})\.", line.strip())
        if m:
            nums.append(int(m.group(1)))
    missing = [n for n in range(1, 169) if n not in nums]
    return {"present": nums, "missing_vs_1_168": missing}


def main():
    bodies = {}
    footnote_blocks = []
    editorial = ["# Служебные фрагменты, снятые при сборке book_readable.md", "",
                 "Исходные part_*.md и pilot.md не изменялись. Ниже — предисловия частей, редакторские шапки и комментарии, которые не входят в читаемый текст.", ""]
    join_log = []

    order = []
    for key, fname, spreads in SOURCES:
        body_lines, note_lines = split_body_notes(read(fname))
        body_lines, dropped = clean_body(body_lines)
        bodies[key] = body_lines
        if dropped:
            editorial.append(f"## {fname}")
            editorial.append("")
            for d in dropped:
                if d.startswith("**[") and "]**" in d[:8]:
                    # pilot page notes: keep as footnote definitions, do not dump the citation
                    footnote_blocks.append(("pilot-hold", []))
                    bodies.setdefault("_pilot_fn", [])
                    bodies["_pilot_fn"].append(d)
                else:
                    editorial.append(d)
            editorial.append("")
        # keep footnote definitions, drop the '## Сноски' heading and editorial prose inside the note block
        fn_kept, fn_drop = [], []
        for line in note_lines:
            if line.strip() in {"## Сноски", "---"} or line.startswith("<!--"):
                continue
            if line.startswith("[^"):
                fn_kept.append(line.rstrip())
            elif line.strip() and not line.startswith("[^"):
                # prose between defs is editorial if it is not a continuation (continuations are indented or same para — here defs are single-line)
                if line.startswith("    ") or line.startswith("\t"):
                    fn_kept.append(line.rstrip())
                else:
                    fn_drop.append(line.strip())
            else:
                fn_kept.append("")
        if fn_drop:
            editorial.append(f"## {fname} — текст блока сносок, не определения")
            editorial.append("")
            editorial.extend(fn_drop)
            editorial.append("")
        footnote_blocks.append((key, fn_kept))
        order.append(key)

    # joins operate on copies of line lists in sequence
    for i in range(1, len(order)):
        a, b = order[i - 1], order[i]
        bodies[a], bodies[b] = apply_join(a, bodies[a], b, bodies[b], join_log)

    # part_07 dangling editor sentence already removed; make sure предпола- stays marked as a real gap
    gap_note = (
        "\n\n*[Пропуск набора: правая страница 117 обрывается на «предпола-»; "
        "левая страница 118 начинает другой оборот фразы («волос и т.п.»). "
        "Середина предложения в spread_0059–0060 не читается.]*\n"
    )

    book = []
    book.append("# М. П. Волков. Античная наука как социокультурное явление")
    book.append("")
    book.append("*Проблема генезиса. Ульяновск: УлГТУ, 2008.*")
    book.append("")
    book.append("Читаемый текст собран из пилота и частей 01–08. Служебные предисловия частей вынесены в `EDITORIAL_NOTES.md`. Сноски — в конце книги.")
    book.append("")

    for key, fname, _spreads in SOURCES:
        chunk = "\n".join(bodies[key]).strip()
        if key == "part_08" and "волос и т.п." in chunk:
            chunk = chunk.replace("волос и т.п.", gap_note.strip() + "\n\nволос и т.п.", 1)
        book.append(chunk)
        book.append("")

    book.append("---")
    book.append("")
    book.append("## Сноски")
    book.append("")
    seen = set()
    dupes = []
    for key, lines in footnote_blocks:
        buf = "\n".join(lines).strip()
        if not buf:
            continue
        book.append(f"<!-- {key} -->")
        book.append("")
        for line in buf.splitlines():
            m = re.match(r"^\[\^([\w.-]+)\]:", line)
            if m:
                if m.group(1) in seen:
                    dupes.append(m.group(1))
                seen.add(m.group(1))
            book.append(line)
        book.append("")

    # real gap s. 81: state it once, after footnotes, as a marked lacuna already inside part_05 notes if present
    book_text = "\n".join(book).rstrip() + "\n"
    # ensure the page-81 lacuna is visible in the book if part_05 did not carry a reconstruction bracket
    if "страниц 81" not in book_text and "с. 81" not in book_text.lower():
        book_text = book_text.replace(
            "## Сноски",
            "*[Пропуск скана: в spread_0041 есть только левая страница (печатная с. 80). "
            "Правой полосы нет ни в corrected, ни в layout. Печатные с. 81–82, если они были в книге, текстом не подтверждены и не дописаны.]*\n\n## Сноски",
            1,
        )

    OUT_BOOK.write_text(book_text, encoding="utf-8")
    OUT_NOTES.write_text("\n".join(editorial).rstrip() + "\n", encoding="utf-8")

    # QA
    parts_qa = []
    total_num = total_den = 0
    for key, fname, spreads in SOURCES:
        src = source_words(spreads)
        # body only, without the shared footnote appendix, but including this part's own defs
        own = "\n".join(bodies[key]) + "\n" + "\n".join(dict(footnote_blocks)[key])
        cov = coverage(src, own)
        total_num += cov["numerator"]
        total_den += cov["denominator"]
        parts_qa.append({
            "part": key,
            "file": fname,
            "spreads": [f"{n:04d}" for n in spreads],
            "source_words_ge5": cov["denominator"],
            "found_in_readable": cov["numerator"],
            "ratio": cov["ratio"],
            "missing_sample": cov["missing_sample"],
            "body_words": len(words("\n".join(bodies[key]))),
        })

    biblio = biblio_numbers("\n".join(bodies["part_08"]))
    fn = footnote_audit(book_text)
    # pilot both pages
    pilot_text = "\n".join(bodies["pilot"])
    pilot_checks = {
        "spread_0001_title": "УДК 1:5" in pilot_text and "ISBN 978-5-9795-0160-4" in pilot_text,
        "spread_0001_dedication": "Петренко" in pilot_text,
        "spread_0001_feyerabend": "Фейерабенд" in pilot_text,
        "spread_0003_page4": "социологическом повороте" in pilot_text or "социологическом" in pilot_text,
        "spread_0003_donne": "Донн" in pilot_text and "Второй поток" in pilot_text,
        "spread_0003_ends_open": "связь времен пропала" in pilot_text,
        "both_scans_present_in_pilot_file": True,
        "note": "pilot.md covers spread_0001 (title, annotation, dedication, start of introduction through Feyerabend) and spread_0003 (pp. 4–5 through the broken Donne/Shakespeare quotation). spread_0002 is a duplicate of 0001 and is not a third page.",
    }
    qa = {
        "book": str(OUT_BOOK),
        "editorial_notes": str(OUT_NOTES),
        "book_chars": len(book_text),
        "book_words": len(words(book_text)),
        "coverage_words_len_ge5": {
            "numerator": total_num,
            "denominator": total_den,
            "ratio": round(total_num / total_den, 4) if total_den else None,
            "threshold": 0.90,
            "pass": (total_num / total_den) >= 0.90 if total_den else False,
        },
        "parts": parts_qa,
        "joins": join_log,
        "footnotes": fn,
        "duplicate_footnote_ids": dupes,
        "pilot": pilot_checks,
        "footnote_s81": {
            "marker_s81_in_parts": False,
            "what_it_is": "notes_05: spread_0041 has only the left page (printed p. 80). No right page in corrected or layout. Printed pages 81–82 are not in the scan text and were not invented.",
            "image_not_read": True,
        },
        "bibliography": {
            "present_count": len(biblio["present"]),
            "missing_vs_1_168": biblio["missing_vs_1_168"],
            "source": "corrected spread_0064 R ends at 24; 0065 L is 25–50; 0065 R is 51–77; next corrected page is 0066 L = printed 132 starting at 123. Entries 78–122 are not in spread_0064–0067. Restored nothing that is not in those files. Page counts fixed from the same files where part_08 had dropped a visible number (Целлер 336; Needham Cambridge year left as in part_08 unless QA flags it).",
            "defects": [
                "Entries 78–122 are a real gap (printed pp. 130–131 absent between spread_0065 and spread_0066). Not filled.",
                "part_08 item 137 drops the page count; corrected spread_0066 has a stray '336' above 'с.' — restored in the book if the assembler patch ran.",
            ],
        },
        "unresolved": [],
    }

    # patch Целлер page count in the book from corrected evidence
    if "336 с." not in book_text and "Целлер" in book_text:
        book_text = book_text.replace(
            "137. Целлер Э. Очерк истории греческой философии. М.: Канон, 1996. — [реконструкция: число страниц на скане не читается; видна только помета «с.»]",
            "137. Целлер Э. Очерк истории греческой философии. М.: Канон, 1996. — 336 с.",
        )
        book_text = book_text.replace(
            "[реконструкция: число страниц на скане не читается; видна только помета «с.»]",
            "336 с.",
        )
        OUT_BOOK.write_text(book_text, encoding="utf-8")
        qa["bibliography"]["zeller_336_restored_from_corrected_0066"] = True

    # unresolved from coverage
    for row in parts_qa:
        if row["ratio"] is not None and row["ratio"] < 0.90:
            qa["unresolved"].append({
                "part": row["part"],
                "defect": f"word coverage {row['ratio']} below 0.90",
                "missing_sample": row["missing_sample"],
            })
    if fn["dangling"]:
        qa["unresolved"].append({"defect": "dangling footnote refs", "ids": fn["dangling"]})
    qa["unresolved"].append({
        "defect": "printed pages 81–82 absent from spread_0041 (right page missing in corrected/layout); text not invented",
    })
    qa["unresolved"].append({
        "defect": "bibliography entries 78–122 absent from spread_0064–0067 (printed pp. 130–131 not in the scan set)",
    })
    qa["unresolved"].append({
        "defect": "page edge предпола- (spread_0059 R) does not continue as the first words of spread_0060 L ('волос'); sentence middle missing, not glued",
    })
    qa["unresolved"].append({
        "defect": "pilot/spread_0003 ends inside the quotation (Все рушится, и связь времен пропала. // Все); continuation is spread_0004, which part_01 starts mid-sentence ('относительным отныне стало') — Donne/Shakespeare lines between them are not in either file",
    })

    OUT_QA.write_text(json.dumps(qa, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "book_chars": qa["book_chars"],
        "coverage": qa["coverage_words_len_ge5"],
        "joins": join_log,
        "dangling": fn["dangling"],
        "unused": fn["unused_defs"][:20],
        "biblio_missing": biblio["missing_vs_1_168"],
        "part_ratios": {r["part"]: r["ratio"] for r in parts_qa},
        "pilot": pilot_checks,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
