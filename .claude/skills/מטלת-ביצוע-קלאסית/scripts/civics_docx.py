#!/usr/bin/env python3
"""כלי עריכת מסמך ה־Word של מטלת הביצוע (RTL, הערות שוליים אמיתיות, ביבליוגרפיה).

שימוש:
  python3 civics_docx.py init  <dir> [--topic "..."] [--students "א,ב,ג"] [--name work.docx]
  python3 civics_docx.py apply <docx> <ops.json> [--no-backup]
  python3 civics_docx.py bibliography <docx> <sources.json>
  python3 civics_docx.py refresh-toc <docx> [--pages]
  python3 civics_docx.py check <docx> [--sources sources.json] [--students N]
  python3 civics_docx.py render <docx> [outdir]        # PDF + דפי PNG לבדיקה חזותית
  python3 civics_docx.py outline <docx>                # מבנה: כותרות, סטטוס, מילים

ops.json = {"ops": [ {...}, ... ]}  (ראו SKILL.md / references/ops_format.md)
  fill        {"op":"fill","section":"<id|כותרת>","blocks":[...], "append":false, "replace_confirmed":false}
  add_section {"op":"add_section","after":"<id|כותרת>","id":"x","title":"...","level":2,"placeholder":"..."}
  set_cover   {"op":"set_cover","topic":"...","students":["..."]}
  blocks: {"type":"p","text":"... {{fn:הערת שוליים}} ... **מודגש**"}, {"type":"h","level":3,"text":""},
          {"type":"bullets","items":[...]}, {"type":"numbered","items":[...]},
          {"type":"table","header":[...],"rows":[[...]],"caption":"..."},
          {"type":"image","path":"x.png","width_cm":14,"caption":"...","alt":"..."},
          {"type":"placeholder","text":"..."}, {"type":"pagebreak"}

העיקרון: הכלי לא מוחק תוכן קיים. מילוי מחליף רק פסקאות "[להשלמה: ...]".
"""
import argparse
import copy
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile

from lxml import etree
import docx
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.opc.packuri import PackURI
from docx.opc.part import Part
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

FONT = "Arial"
TOC_TAB_VAL = os.environ.get("CIVICS_TOC_TAB", "left")
BODY_PT = 12
W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
FOOT_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"
HEB = re.compile(r"[֐-׿]")
PLACEHOLDER_PREFIX = "[להשלמה"
FN_RE = re.compile(r"(\{\{fn:.*?\}\}|\*\*.+?\*\*)", re.S)

# מבנה ברירת מחדל: (id, רמת כותרת, כותרת, טקסט להשלמה)
SKELETON = [
    ("problem", 1, "הבעיה האזרחית", None),
    ("problem_formulation", 2, "1. ניסוח הבעיה האזרחית", "[להשלמה: תיאור התופעה, הצגת הבעיה האזרחית וקישור ל־3 מושגים לפחות]"),
    ("problem_rationale", 2, "2. נימוק הבחירה בסוגיה (באמצעות ערך מרכזי)", "[להשלמה: נימוק הבחירה, ערך מרכזי, אקטואליות ופתרון מעשי]"),
    ("lit", 1, "שלב שני: סקירת ספרות", None),
    ("lit_personal", 2, "חלק אישי: סיכום כל מקור", "[להשלמה: סיכומי מקורות אישיים – מקור אחד לפחות לכל תלמיד]"),
    ("lit_group", 2, "חלק קבוצתי: סקירת ספרות ממוזגת", "[להשלמה: סקירה ממוזגת – רק אחרי שכל החלקים האישיים הושלמו]"),
    ("lit_summary", 2, "סיכום סקירת הספרות ומסקנות", "[להשלמה: סיכום תובנות והקשר להמשך הבדיקה]"),
    ("practical", 1, "שלב שלישי: בדיקה מעשית", None),
    ("practical_problem", 2, "אזכור הבעיה הנבדקת", "[להשלמה]"),
    ("practical_tools", 2, "הצגת הכלים: שאלון, ריאיון, תצפית", "[להשלמה: מהו כל כלי, יתרונות, חסרונות, התאמה לבעיה]"),
    ("practical_choice", 2, "שיקולי הדעת בבחירת הכלי", "[להשלמה: הכלי שנבחר והנימוק]"),
    ("practical_tool", 2, "הכלי שנבנה", "[להשלמה: נוסח השאלון / שאלות הריאיון / טופס התצפית]"),
    ("findings", 2, "הצגת הממצאים", "[להשלמה: אוכלוסייה, ממצאים מילוליים ותרשימים]"),
    ("findings_summary", 2, "סיכום הממצאים", "[להשלמה: ממצאים מהשטח; קשר לבעיה; קשר לסקירת הספרות; קרבה לפתרון; מגבלות]"),
    ("argument", 1, "שלב רביעי: פסקת טיעון – דיון ומסקנות", None),
    ("claim", 2, "טענתנו היא", "[להשלמה]"),
    ("reasons_lit", 2, "נימוקים מסקירת הספרות", "[להשלמה]"),
    ("reasons_field", 2, "נימוקים מהבדיקה בשטח", "[להשלמה: דורש נתוני שטח]"),
    ("conclusion", 2, "מסקנה", "[להשלמה]"),
    ("solutions", 2, "פתרונות מוצעים", "[להשלמה: פתרונות עם יתרון וחסרון לכל אחד]"),
    ("solution_choice", 2, "הפתרון שנבחר ונימוקו", "[להשלמה: רק אחרי שהתלמידים בחרו]"),
    ("value", 2, "הערך שבא לידי ביטוי בפתרון", "[להשלמה]"),
    ("product", 1, "שלב חמישי: תוצר", "[להשלמה: התוצר, הנימוק, היעד, הצעד הראשון והוכחה ליישום]"),
    ("reflection", 1, "שלב שישי: רפלקציה", "[להשלמה: רפלקציה אישית לכל תלמיד]"),
    ("bibliography", 1, "שלב שביעי: ביבליוגרפיה", "[להשלמה: תיבנה מרישום המקורות]"),
    ("appendices", 1, "שלב שמיני: נספחים", "[להשלמה: לפי הצורך]"),
]


# ───────────────────────── עזרים כלליים ─────────────────────────
def fail(msg):
    print("שגיאה: " + msg, file=sys.stderr)
    sys.exit(2)


def el(tag, **attrs):
    e = OxmlElement(tag)
    for k, v in attrs.items():
        e.set(qn(k.replace("_", ":", 1)), str(v))
    return e


def ptext(p):
    return "".join(t.text or "" for t in p.iter(qn("w:t")))


def is_placeholder_p(p):
    return ptext(p).strip().startswith(PLACEHOLDER_PREFIX)


def heading_level(p):
    """החזר רמת כותרת (1..9) או None, לפי pStyle או outlineLvl."""
    if p.tag != qn("w:p"):
        return None
    ppr = p.find(qn("w:pPr"))
    if ppr is None:
        return None
    st = ppr.find(qn("w:pStyle"))
    if st is not None:
        v = st.get(qn("w:val")) or ""
        m = re.match(r"(?i)^(heading|כותרת)\s*(\d)$", v)
        if m:
            return int(m.group(2))
    ol = ppr.find(qn("w:outlineLvl"))
    if ol is not None:
        return int(ol.get(qn("w:val"))) + 1
    return None


def norm(s):
    return re.sub(r"\s+", " ", s).strip().strip(":").strip()


def body_children(doc):
    return [c for c in doc.element.body if c.tag != qn("w:sectPr")]


def bookmark_names(p):
    return [b.get(qn("w:name")) for b in p.iter(qn("w:bookmarkStart"))]


def find_section(doc, key):
    """מצא כותרת לפי מזהה סימניה sec_<id> או לפי טקסט הכותרת. מחזיר אלמנט פסקה."""
    kids = body_children(doc)
    want = "sec_" + key
    for c in kids:
        if c.tag == qn("w:p") and want in bookmark_names(c):
            return c
    for c in kids:
        if heading_level(c) and norm(ptext(c)) == norm(key):
            return c
    for c in kids:
        if heading_level(c) and norm(key) in norm(ptext(c)):
            return c
    return None


def section_range(doc, head):
    """רשימת האלמנטים (אחרי הכותרת) עד הכותרת הבאה ברמה שווה או גבוהה."""
    lvl = heading_level(head)
    out = []
    started = False
    for c in body_children(doc):
        if c is head:
            started = True
            continue
        if not started:
            continue
        hl = heading_level(c)
        if hl is not None and hl <= lvl:
            break
        out.append(c)
    return out


# ───────────────────────── סגנונות ומסמך ─────────────────────────
def set_rfonts(rpr, font=FONT):
    rf = rpr.find(qn("w:rFonts"))
    if rf is None:
        rf = el("w:rFonts")
        rpr.insert(0, rf)
    for a in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rf.set(qn(a), font)
    for a in ("w:asciiTheme", "w:hAnsiTheme", "w:cstheme", "w:eastAsiaTheme"):
        if rf.get(qn(a)) is not None:
            del rf.attrib[qn(a)]


def style_setup(doc):
    st = doc.styles
    # ברירות מחדל של המסמך: גופן, שפה, כיווניות
    rpr_default = st.element.find(qn("w:docDefaults")).find(qn("w:rPrDefault")).find(qn("w:rPr"))
    set_rfonts(rpr_default)
    for old in rpr_default.findall(qn("w:lang")):
        rpr_default.remove(old)
    rpr_default.append(el("w:lang", w_val="he-IL", w_eastAsia="he-IL", w_bidi="he-IL"))
    for tag in ("w:sz", "w:szCs"):
        for old in rpr_default.findall(qn(tag)):
            rpr_default.remove(old)
        rpr_default.append(el(tag, w_val=BODY_PT * 2))

    def para_style(name, size, bold=False, color=None, before=0, after=6, keep=False, base=None, line=None):
        try:
            s = st[name]
        except KeyError:
            s = st.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
            if base:
                s.base_style = st[base]
        rpr = s.element.get_or_add_rPr()
        set_rfonts(rpr)
        s.font.size = Pt(size)
        s.font.bold = bold
        s.font.italic = False
        if color:
            s.font.color.rgb = RGBColor.from_string(color)
        else:
            s.font.color.rgb = RGBColor(0, 0, 0)
        for tag in ("w:szCs", "w:bCs"):
            for old in rpr.findall(qn(tag)):
                rpr.remove(old)
        rpr.append(el("w:szCs", w_val=int(size * 2)))
        if bold:
            rpr.append(el("w:bCs"))
        ppr = s.element.get_or_add_pPr()
        for tag in ("w:bidi", "w:jc"):
            for old in ppr.findall(qn(tag)):
                ppr.remove(old)
        ppr.append(el("w:bidi"))
        s.paragraph_format.space_before = Pt(before)
        s.paragraph_format.space_after = Pt(after)
        s.paragraph_format.keep_with_next = keep
        if line:
            s.paragraph_format.line_spacing = line
        return s

    # אחידות גופן: כל רשומת גופן מפורשת בסגנונות התבנית מוחלפת
    for rf in st.element.iter(qn("w:rFonts")):
        set_rfonts(rf.getparent())
    para_style("Normal", BODY_PT, after=6, line=1.25)
    para_style("Heading 1", 18, True, "1F3864", before=18, after=8, keep=True, line=1.1)
    para_style("Heading 2", 14, True, "1F3864", before=12, after=6, keep=True, line=1.1)
    para_style("Heading 3", 12, True, "000000", before=8, after=4, keep=True, line=1.1)
    para_style("Title", 28, True, "1F3864", before=0, after=12, line=1.1)
    para_style("Caption", 10, False, "404040", before=2, after=10)
    for n in ("List Bullet", "List Number"):
        para_style(n, BODY_PT, after=3, line=1.25)
    para_style("TOC Title", 18, True, "1F3864", before=0, after=10)
    para_style("TOC 1", BODY_PT, True, before=4, after=2, line=1.0)
    para_style("TOC 2", BODY_PT, False, after=1, line=1.0)
    st["TOC 2"].paragraph_format.left_indent = Cm(0.8)  # בכיווניות RTL הזחה "משמאל" = הזחה מצד ההתחלה
    para_style("Footnote Text", 10, after=0, line=1.0)
    fr = st.add_style("Footnote Reference", WD_STYLE_TYPE.CHARACTER) if "Footnote Reference" not in [s.name for s in st] else st["Footnote Reference"]
    fr.font.superscript = True
    fr.font.name = FONT
    set_rfonts(fr.element.get_or_add_rPr())


def style_id(doc, name):
    return doc.styles[name].style_id


def set_par_rtl(p_el, jc="start"):
    ppr = p_el.get_or_add_pPr() if hasattr(p_el, "get_or_add_pPr") else None
    if ppr is None:
        ppr = p_el.find(qn("w:pPr"))
        if ppr is None:
            ppr = el("w:pPr")
            p_el.insert(0, ppr)
    if ppr.find(qn("w:bidi")) is None:
        ppr.append(el("w:bidi"))
    return ppr


def make_run(text, bold=False, size=None, rtl=None, color=None):
    r = el("w:r")
    rpr = el("w:rPr")
    set_rfonts(rpr)
    if bold:
        rpr.append(el("w:b"))
        rpr.append(el("w:bCs"))
    if color:
        rpr.append(el("w:color", w_val=color))
    if size:
        rpr.append(el("w:sz", w_val=int(size * 2)))
        rpr.append(el("w:szCs", w_val=int(size * 2)))
    if rtl is None:
        rtl = bool(HEB.search(text))
    if rtl:
        rpr.append(el("w:rtl"))
    r.append(rpr)
    t = el("w:t")
    t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    t.text = text
    r.append(t)
    return r


# ───────────────────────── הערות שוליים ─────────────────────────
class Footnotes:
    def __init__(self, doc):
        self.doc = doc
        self.part = None
        for rel in doc.part.rels.values():
            if rel.reltype == RT.FOOTNOTES:
                self.part = rel.target_part
        if self.part is None:
            xml = (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                f'<w:footnotes xmlns:w="{W_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                '<w:footnote w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:footnote>'
                '<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>'
                "</w:footnotes>"
            )
            self.part = Part(PackURI("/word/footnotes.xml"), FOOT_CT, xml.encode("utf-8"), doc.part.package)
            doc.part.relate_to(self.part, RT.FOOTNOTES)
            self._ensure_settings()
        self.root = etree.fromstring(self.part.blob)

    def _ensure_settings(self):
        s = self.doc.settings.element
        if s.find(qn("w:footnotePr")) is None:
            fp = el("w:footnotePr")
            fp.append(el("w:footnote", w_id="-1"))
            fp.append(el("w:footnote", w_id="0"))
            anchor = None
            for tag in ("w:endnotePr", "w:compat", "w:docVars", "w:rsids"):
                anchor = s.find(qn(tag))
                if anchor is not None:
                    break
            if anchor is not None:
                anchor.addprevious(fp)
            else:
                s.append(fp)

    def next_id(self):
        ids = [int(f.get(qn("w:id"))) for f in self.root.findall(qn("w:footnote"))]
        return max([0] + ids) + 1

    def add(self, text):
        fid = self.next_id()
        fn = etree.SubElement(self.root, qn("w:footnote"))
        fn.set(qn("w:id"), str(fid))
        p = etree.SubElement(fn, qn("w:p"))
        ppr = etree.SubElement(p, qn("w:pPr"))
        ps = etree.SubElement(ppr, qn("w:pStyle"))
        ps.set(qn("w:val"), style_id(self.doc, "Footnote Text"))
        etree.SubElement(ppr, qn("w:bidi"))
        r = etree.SubElement(p, qn("w:r"))
        rpr = etree.SubElement(r, qn("w:rPr"))
        rs = etree.SubElement(rpr, qn("w:rStyle"))
        rs.set(qn("w:val"), style_id(self.doc, "Footnote Reference"))
        etree.SubElement(r, qn("w:footnoteRef"))
        # טקסט ההערה: מפצלים לרצפים עבריים/לטיניים כדי לשמור סדר תקין
        r2 = make_run(" " + text.strip())
        # make_run מחזיר אלמנט python-docx; ממירים ל-lxml רגיל
        p.append(etree.fromstring(etree.tostring(r2)))
        return fid

    def save(self):
        self.part._blob = etree.tostring(self.root, xml_declaration=True, encoding="UTF-8", standalone=True)


def footnote_ref_run(doc, fid):
    r = el("w:r")
    rpr = el("w:rPr")
    rpr.append(el("w:rStyle", w_val=style_id(doc, "Footnote Reference")))
    r.append(rpr)
    r.append(el("w:footnoteReference", w_id=fid))
    return r


# ───────────────────────── בניית בלוקים ─────────────────────────
class Builder:
    def __init__(self, doc, base_dir):
        self.doc = doc
        self.base_dir = base_dir
        self.fn = Footnotes(doc)
        self.warnings = []

    def _anchor(self):
        """אלמנט זמני בסוף הגוף: python-docx מוסיף אליו; אנחנו מעבירים."""
        return self.doc.element.body

    def para(self, text, style=None, align=None, bold=False, size=None, keep_next=False):
        p = el("w:p")
        ppr = el("w:pPr")
        if style:
            ppr.append(el("w:pStyle", w_val=style_id(self.doc, style)))
        if keep_next:
            ppr.append(el("w:keepNext"))
        ppr.append(el("w:bidi"))
        if align:
            ppr.append(el("w:jc", w_val=align))
        p.append(ppr)
        for tok in FN_RE.split(text):
            if not tok:
                continue
            if tok.startswith("{{fn:"):
                fid = self.fn.add(tok[5:-2])
                p.append(footnote_ref_run(self.doc, fid))
            elif tok.startswith("**") and tok.endswith("**") and len(tok) > 4:
                p.append(make_run(tok[2:-2], bold=True, size=size))
            else:
                p.append(make_run(tok, bold=bold, size=size))
        return p

    def heading(self, level, text, sec_id=None):
        p = self.para(text, style=f"Heading {level}", keep_next=True)
        if sec_id:
            self._bookmark(p, "sec_" + sec_id)
        return p

    def _bookmark(self, p, name):
        ids = [int(b.get(qn("w:id"))) for b in self.doc.element.body.iter(qn("w:bookmarkStart"))]
        bid = max([0] + ids) + 1
        bs = el("w:bookmarkStart", w_id=bid, w_name=name)
        be = el("w:bookmarkEnd", w_id=bid)
        ppr = p.find(qn("w:pPr"))
        idx = list(p).index(ppr) + 1 if ppr is not None else 0
        p.insert(idx, bs)
        p.append(be)

    def list_items(self, items, numbered=False):
        out = []
        for it in items:
            out.append(self.para(it, style="List Number" if numbered else "List Bullet"))
        return out

    def table(self, header, rows, caption=None):
        ncols = len(header)
        tbl = self.doc.add_table(rows=1 + len(rows), cols=ncols)
        tbl.style = self.doc.styles["Table Grid"]
        t = tbl._tbl
        tblpr = t.tblPr
        for old in tblpr.findall(qn("w:bidiVisual")):
            tblpr.remove(old)
        tblpr.append(el("w:bidiVisual"))
        for ri, row in enumerate([header] + rows):
            if len(row) != ncols:
                fail(f"שורת טבלה באורך {len(row)} במקום {ncols}: {row}")
            for ci, val in enumerate(row):
                cell = tbl.cell(ri, ci)
                tc = cell._tc
                for old in list(tc.findall(qn("w:p"))):
                    tc.remove(old)
                lines = str(val).split("\n")
                for ln in lines:
                    tc.append(self.para(ln, bold=(ri == 0), size=11))
                if ri == 0:
                    tcpr = tc.get_or_add_tcPr()
                    tcpr.append(el("w:shd", w_val="clear", w_color="auto", w_fill="D9E2F3"))
        elems = [t]
        if caption:
            elems.append(self.para(caption, style="Caption"))
        return elems

    def image(self, path, width_cm=14, caption=None, alt=None):
        full = path if os.path.isabs(path) else os.path.join(self.base_dir, path)
        if not os.path.exists(full):
            fail(f"קובץ תמונה לא נמצא: {full}")
        tmp = self.doc.add_paragraph()
        run = tmp.add_run()
        run.add_picture(full, width=Cm(width_cm))
        pel = tmp._p
        pel.getparent().remove(pel)
        ppr = el("w:pPr")
        ppr.append(el("w:keepNext"))
        ppr.append(el("w:bidi"))
        ppr.append(el("w:jc", w_val="center"))
        pel.insert(0, ppr)
        for dp in pel.iter("{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}docPr"):
            dp.set("descr", alt or caption or "תרשים")
        out = [pel]
        if caption:
            out.append(self.para(caption, style="Caption", align="center"))
        else:
            self.warnings.append("תמונה ללא כיתוב: " + os.path.basename(path))
        return out

    def blocks(self, blocks):
        out = []
        for b in blocks:
            t = b.get("type", "p")
            if t == "p":
                out.append(self.para(b["text"]))
            elif t == "h":
                out.append(self.heading(int(b.get("level", 3)), b["text"], b.get("id")))
            elif t == "bullets":
                out += self.list_items(b["items"])
            elif t == "numbered":
                out += self.list_items(b["items"], numbered=True)
            elif t == "table":
                out += self.table(b["header"], b["rows"], b.get("caption"))
            elif t == "image":
                out += self.image(b["path"], b.get("width_cm", 14), b.get("caption"), b.get("alt"))
            elif t == "placeholder":
                out.append(self.para(b["text"] if b["text"].startswith(PLACEHOLDER_PREFIX) else "[להשלמה: " + b["text"] + "]"))
            elif t == "pagebreak":
                p = el("w:p")
                r = el("w:r")
                r.append(el("w:br", w_type="page"))
                p.append(r)
                out.append(p)
            else:
                fail("סוג בלוק לא מוכר: " + t)
        return out


# ───────────────────────── שער, תוכן עניינים, אתחול ─────────────────────────
def add_page_number_footer(doc):
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.left_margin = sec.right_margin = Cm(2.5)
    sec.top_margin = sec.bottom_margin = Cm(2.2)
    f = sec.footer
    f.is_linked_to_previous = False
    p = f.paragraphs[0]._p
    for c in list(p):
        p.remove(c)
    ppr = el("w:pPr")
    ppr.append(el("w:bidi"))
    ppr.append(el("w:jc", w_val="center"))
    p.append(ppr)
    for kind, txt in (("begin", None), ("instr", " PAGE "), ("separate", None), ("text", "1"), ("end", None)):
        r = el("w:r")
        rpr = el("w:rPr")
        set_rfonts(rpr)
        r.append(rpr)
        if kind == "instr":
            it = el("w:instrText")
            it.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
            it.text = txt
            r.append(it)
        elif kind == "text":
            t = el("w:t")
            t.text = txt
            r.append(t)
        else:
            r.append(el("w:fldChar", w_fldCharType=kind))
        p.append(r)


def toc_paragraphs(b, entries):
    """entries: [(level, text, page|None)] → פסקאות עם שדה TOC (מטמון)."""
    paras = []
    n = max(1, len(entries))
    for i in range(n):
        lvl, text, page = entries[i] if entries else (1, "(לחצו קליק ימני ובחרו 'עדכון שדה' כדי לייצר תוכן עניינים)", None)
        p = el("w:p")
        ppr = el("w:pPr")
        ppr.append(el("w:pStyle", w_val=style_id(b.doc, f"TOC {min(lvl, 2)}")))
        tabs = el("w:tabs")
        tabs.append(el("w:tab", w_val=TOC_TAB_VAL, w_leader="dot", w_pos=8300))
        ppr.append(tabs)
        ppr.append(el("w:bidi"))
        p.append(ppr)
        if i == 0:
            r = el("w:r"); r.append(el("w:fldChar", w_fldCharType="begin")); p.append(r)
            r = el("w:r"); it = el("w:instrText"); it.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
            it.text = ' TOC \\o "1-2" \\h \\z \\u '
            r.append(it); p.append(r)
            r = el("w:r"); r.append(el("w:fldChar", w_fldCharType="separate")); p.append(r)
        p.append(make_run(text))
        if page is not None:
            r = el("w:r"); r.append(el("w:tab")); p.append(r)
            p.append(make_run(str(page), rtl=False))
        if i == n - 1:
            r = el("w:r"); r.append(el("w:fldChar", w_fldCharType="end")); p.append(r)
        paras.append(p)
    return paras


def set_update_fields(doc):
    s = doc.settings.element
    if s.find(qn("w:updateFields")) is None:
        uf = el("w:updateFields", w_val="true")
        anchor = None
        for tag in ("w:hdrShapeDefaults", "w:footnotePr", "w:endnotePr", "w:compat"):
            anchor = s.find(qn(tag))
            if anchor is not None:
                break
        if anchor is not None:
            anchor.addprevious(uf)
        else:
            s.append(uf)


def build_cover(b, topic, students):
    out = []
    for _ in range(5):
        out.append(b.para("", ))
    out.append(b.para("מטלת ביצוע באזרחות – חלופה קלאסית", style="Title", align="center"))
    tp = topic if topic else "[להשלמה: נושא העבודה]"
    out.append(b.para("בנושא: " + tp, align="center", bold=True, size=18))
    out.append(b.para("", ))
    out.append(b.para("שמות התלמידים בקבוצה:", align="center", bold=True, size=14))
    if students:
        for i, s in enumerate(students, 1):
            out.append(b.para(f"{i}. {s}", align="center", size=14))
    else:
        out.append(b.para("[להשלמה: שמות התלמידים]", align="center", size=14))
    out.append(b.para("", ))
    out.append(b.para(datetime.date.today().strftime("%d.%m.%Y"), align="center", size=12))
    pb = el("w:p"); r = el("w:r"); r.append(el("w:br", w_type="page")); pb.append(r)
    out.append(pb)
    return out


def cmd_init(args):
    d = args.dir
    os.makedirs(d, exist_ok=True)
    out = os.path.join(d, args.name)
    if os.path.exists(out):
        fail(f"הקובץ כבר קיים: {out}. לא נוצר מסמך חדש במקומו – המשיכו לערוך אותו (apply).")
    doc = docx.Document()
    style_setup(doc)
    add_page_number_footer(doc)
    body = doc.element.body
    for c in list(body):
        if c.tag != qn("w:sectPr"):
            body.remove(c)
    b = Builder(doc, d)
    students = [s.strip() for s in (args.students or "").split(",") if s.strip()]
    content = build_cover(b, args.topic, students)
    content.append(b.para("תוכן עניינים", style="TOC Title"))
    content += toc_paragraphs(b, [])
    pb = el("w:p"); r = el("w:r"); r.append(el("w:br", w_type="page")); pb.append(r)
    content.append(pb)
    for sid, lvl, title, ph in SKELETON:
        content.append(b.heading(lvl, title, sid))
        if ph:
            content.append(b.para(ph))
    sect = body.find(qn("w:sectPr"))
    for c in content:
        sect.addprevious(c)
    set_update_fields(doc)
    doc.core_properties.title = "מטלת ביצוע באזרחות – חלופה קלאסית"
    doc.core_properties.author = ""
    doc.core_properties.language = "he-IL"
    b.fn.save()
    doc.save(out)
    state = os.path.join(d, "state.json")
    if not os.path.exists(state):
        json.dump(
            {
                "topic": args.topic or "",
                "students": students,
                "active_document": args.name,
                "note_relaxations": "המורה הורה להתעלם מהקלות הקיץ; עובדים לפי הנוסח המלא",
                "stages": {},
                "notes": "קובץ מצב קבוצה. אין לשמור כאן מספרי זהות או פרטי קשר.",
            },
            open(state, "w", encoding="utf-8"),
            ensure_ascii=False,
            indent=2,
        )
    src = os.path.join(d, "sources.json")
    if not os.path.exists(src):
        json.dump({"sources": []}, open(src, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"נוצר: {out}\nנוצרו גם: state.json, sources.json (אם לא היו קיימים)")


# ───────────────────────── apply ─────────────────────────
def load_doc(path):
    if not os.path.exists(path):
        fail("קובץ לא נמצא: " + path)
    return docx.Document(path)


def has_protected(elems):
    for e in elems:
        if e.tag == qn("w:tbl"):
            return "טבלה"
        for x in e.iter():
            if x.tag in (qn("w:drawing"), qn("w:pict")):
                return "תמונה/תרשים"
            if x.tag == qn("w:footnoteReference"):
                return "הערת שוליים"
    return None


def op_fill(doc, b, op):
    head = find_section(doc, op["section"])
    if head is None:
        fail("סעיף לא נמצא: " + op["section"] + " – הכלי מזהה סעיפים לפי סגנון כותרת (Heading) או סימניה. "
             "אם המסמך נכתב ידנית בלי סגנונות כותרת, הריצו outline לבדיקה והציעו למורה מסמך חדש מ-init (המקור נשאר ללא שינוי).")
    rng = section_range(doc, head)
    # בתוך הטווח: רק עד כותרת מכל רמה (כדי לא למחוק תתי־סעיפים)
    direct = []
    for c in rng:
        if heading_level(c) is not None:
            break
        direct.append(c)
    placeholders = [c for c in direct if c.tag == qn("w:p") and is_placeholder_p(c)]
    real = [c for c in direct if not (c.tag == qn("w:p") and (is_placeholder_p(c) or not ptext(c).strip() and not has_protected([c])))]
    new = b.blocks(op["blocks"])
    if real and not op.get("append") and not op.get("replace_confirmed"):
        fail(f"הסעיף '{op['section']}' כבר כולל תוכן. השתמשו ב-\"append\": true להוספה, או הסכמה מפורשת של המורה + \"replace_confirmed\": true להחלפה.")
    if real and op.get("replace_confirmed") and not op.get("append"):
        prot = has_protected(real)
        if prot and not op.get("allow_destroy"):
            fail(f"בסעיף '{op['section']}' יש {prot} – לא נמחק. אם המורה אישר במפורש, הוסיפו \"allow_destroy\": true.")
        for c in real:
            c.getparent().remove(c)
    anchor = None
    for ph in placeholders:
        if anchor is None:
            anchor = ph
        else:
            ph.getparent().remove(ph)
    if anchor is not None:
        for n in new:
            anchor.addprevious(n)
        anchor.getparent().remove(anchor)
    else:
        # הוספה בסוף החלק הישיר של הסעיף (לפני תת־הכותרת הראשונה)
        last = head
        for c in direct:
            last = c
        for n in new:
            last.addnext(n)
            last = n


def op_add_section(doc, b, op):
    after = find_section(doc, op["after"])
    if after is None:
        fail("סעיף 'after' לא נמצא: " + op["after"])
    if find_section(doc, op["id"]) is not None and ("sec_" + op["id"]) in [n for c in body_children(doc) for n in (bookmark_names(c) if c.tag == qn("w:p") else [])]:
        fail("מזהה סעיף כבר קיים: " + op["id"])
    # נכנסים לסוף הסעיף 'after' כולל כל תתי־הסעיפים
    last = after
    lvl_after = heading_level(after)
    for c in section_range(doc, after):
        last = c
    h = b.heading(int(op.get("level", lvl_after + 1)), op["title"], op["id"])
    items = [h]
    if op.get("placeholder"):
        items.append(b.para(op["placeholder"] if op["placeholder"].startswith(PLACEHOLDER_PREFIX) else "[להשלמה: " + op["placeholder"] + "]"))
    for n in items:
        last.addnext(n)
        last = n


def op_set_cover(doc, b, op):
    kids = body_children(doc)
    stop = None
    for c in kids:
        if ptext(c).strip() == "תוכן עניינים":
            stop = c
            break
    cover = kids[: kids.index(stop)] if stop is not None else []
    for c in cover:
        t = ptext(c)
        if "topic" in op and t.startswith("בנושא:"):
            for r in list(c.findall(qn("w:r"))):
                c.remove(r)
            c.append(make_run("בנושא: " + op["topic"], bold=True, size=18))
        if "students" in op and (t.strip().startswith("שמות התלמידים בקבוצה")):
            # מחליפים את הפסקאות הממוספרות שאחריו
            idx = cover.index(c)
            j = idx + 1
            while j < len(cover) and (re.match(r"^\d+\.", ptext(cover[j]).strip()) or ptext(cover[j]).strip().startswith(PLACEHOLDER_PREFIX)):
                cover[j].getparent().remove(cover[j])
                j += 1
            anchor = c
            for i, s in enumerate(op["students"], 1):
                p = b.para(f"{i}. {s}", align="center", size=14)
                anchor.addnext(p)
                anchor = p
            break


def cmd_apply(args):
    path = args.docx
    ops = json.load(open(args.ops, encoding="utf-8"))["ops"]
    if not args.no_backup:
        bdir = os.path.join(os.path.dirname(os.path.abspath(path)), "backups")
        os.makedirs(bdir, exist_ok=True)
        stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        shutil.copy2(path, os.path.join(bdir, f"{os.path.splitext(os.path.basename(path))[0]}-{stamp}.docx"))
    doc = load_doc(path)
    if "Footnote Text" not in [s.name for s in doc.styles]:
        # מסמך קיים בלי סגנונות הערות: מוסיפים בלי לשנות סגנונות אחרים
        fs = doc.styles.add_style("Footnote Text", WD_STYLE_TYPE.PARAGRAPH)
        fs.font.size = Pt(10)
        fr = doc.styles.add_style("Footnote Reference", WD_STYLE_TYPE.CHARACTER)
        fr.font.superscript = True
    for need, base in (("List Bullet", None), ("List Number", None), ("Caption", None), ("Table Grid", None)):
        if need not in [s.name for s in doc.styles]:
            print(f"אזהרה: הסגנון '{need}' חסר במסמך; ייתכן שהעיצוב ברירת מחדל.", file=sys.stderr)
    b = Builder(doc, os.path.dirname(os.path.abspath(args.ops)))
    before_fn = len(b.fn.root.findall(qn("w:footnote")))
    for op in ops:
        k = op["op"]
        if k == "fill":
            op_fill(doc, b, op)
        elif k == "add_section":
            op_add_section(doc, b, op)
        elif k == "set_cover":
            op_set_cover(doc, b, op)
        else:
            fail("פעולה לא מוכרת: " + k)
    b.fn.save()
    set_update_fields(doc)
    doc.save(path)
    after_fn = len(b.fn.root.findall(qn("w:footnote")))
    print(f"עודכן: {path} | פעולות: {len(ops)} | הערות שוליים חדשות: {after_fn - before_fn}")
    for w in b.warnings:
        print("אזהרה: " + w)


# ───────────────────────── ביבליוגרפיה ─────────────────────────
def format_source(s):
    parts = []
    who = s.get("author_or_body") or "[חסר: מחבר/גוף]"
    parts.append(who)
    parts.append("“" + (s.get("title") or "[חסר: כותרת]") + "”")
    if s.get("pages_or_section"):
        parts.append(s["pages_or_section"])
    parts.append(s.get("date") or "[חסר: תאריך]")
    line = ", ".join(parts) + "."
    if s.get("url"):
        line += " " + s["url"]
    if s.get("access_date"):
        line += " (נצפה ב־" + s["access_date"] + ")"
    return line


TYPE_ORDER = [("law", "חקיקה"), ("bill", "חקיקה"), ("regulation", "חקיקה"), ("court", "פסיקה"), ("official-report", "דוחות ומחקרים רשמיים"),
              ("research", "דוחות ומחקרים רשמיים"), ("protocol", "דוחות ומחקרים רשמיים"), ("media", "מקורות תקשורתיים"), ("other", "מקורות נוספים")]


def cmd_bibliography(args):
    srcs = json.load(open(args.sources, encoding="utf-8"))["sources"]
    used = [s for s in srcs if s.get("status") in ("approved", "cited-only") and s.get("used_in")]
    skipped = [s["id"] for s in srcs if s.get("status") in ("approved", "cited-only") and not s.get("used_in")]
    doc = load_doc(args.docx)
    b = Builder(doc, os.path.dirname(os.path.abspath(args.sources)))
    head = find_section(doc, "bibliography")
    if head is None:
        fail("לא נמצא פרק ביבליוגרפיה")
    rng = section_range(doc, head)
    direct = []
    for c in rng:
        if heading_level(c) is not None:
            break
        direct.append(c)
    old_bib = [c for c in direct if c.getparent() is not None]
    if has_protected(old_bib):
        fail("בפרק הביבליוגרפיה יש הערות שוליים/תמונות/טבלאות – לא נמחק אוטומטית.")
    new = []
    if not used:
        new.append(b.para("[להשלמה: אין עדיין מקורות מאושרים ברישום המקורות]"))
    cats = {}
    for typ, label in TYPE_ORDER:
        cats.setdefault(label, [])
    for s in used:
        label = dict(TYPE_ORDER).get(s.get("type", "other"), "מקורות נוספים")
        cats[label].append(s)
    for label, items in cats.items():
        if not items:
            continue
        new.append(b.para(label, style="Heading 3"))
        for s in sorted(items, key=lambda x: (x.get("author_or_body") or "", x.get("title") or "")):
            new.append(b.para(format_source(s)))
    backup_dir = os.path.join(os.path.dirname(os.path.abspath(args.docx)), "backups")
    os.makedirs(backup_dir, exist_ok=True)
    shutil.copy2(args.docx, os.path.join(backup_dir, "pre-bibliography-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S") + ".docx"))
    anchor = old_bib[0] if old_bib else None
    for c in old_bib[1:]:
        c.getparent().remove(c)
    if anchor is not None:
        for n in new:
            anchor.addprevious(n)
        anchor.getparent().remove(anchor)
    else:
        last = head
        for n in new:
            last.addnext(n)
            last = n
    b.fn.save()
    doc.save(args.docx)
    print(f"ביבליוגרפיה עודכנה: {len(used)} מקורות. (לא נכללו: proposed/rejected). מקורות מאושרים שאין להם 'used_in': {skipped or 'אין'}")


# ───────────────────────── תוכן עניינים ─────────────────────────
def heading_entries(doc):
    out = []
    for c in body_children(doc):
        lvl = heading_level(c)
        if lvl and lvl <= 2 and c.tag == qn("w:p"):
            t = ptext(c).strip()
            if t:
                out.append((lvl, t, None))
    return out


def render_pdf(docx_path, outdir):
    os.makedirs(outdir, exist_ok=True)
    r = subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", outdir, docx_path], capture_output=True, text=True, timeout=180)
    pdf = os.path.join(outdir, os.path.splitext(os.path.basename(docx_path))[0] + ".pdf")
    if not os.path.exists(pdf):
        fail("המרה ל-PDF נכשלה (LibreOffice): " + r.stderr[-300:])
    return pdf


def pdf_pages_text(pdf):
    out = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True).stdout
    pages = out.split("\f")
    return [re.sub("[\u200e\u200f\u202a-\u202e\u2066-\u2069]", " ", p) for p in pages]


def _tokens(s):
    return sorted(re.findall(r"\w+", s))


def line_matches(title, line):
    """התאמה לפי אוסף מילים (pdftotext משנה סדר סימני פיסוק בעברית)."""
    a, b = _tokens(title), _tokens(line)
    return bool(a) and a == b


def locate_pages(doc, pdf):
    pages = pdf_pages_text(pdf)
    res = {}
    start = 1
    for i, pg in enumerate(pages):
        if "תוכן עניינים" in pg or "....." in pg:
            start = i + 1  # מדלגים על שער ותוכן עניינים (כולל גלישה)
    cur = start
    for lvl, t, _ in heading_entries(doc):
        found = None
        for i in range(max(cur - 1, 0), len(pages)):
            if i < start:
                continue
            if any(line_matches(t, line) for line in pages[i].splitlines()):
                found = i
                break
        if found is not None:
            res[t] = found + 1
            cur = found + 1
    return res


def cmd_refresh_toc(args):
    doc = load_doc(args.docx)
    b = Builder(doc, os.path.dirname(os.path.abspath(args.docx)))
    entries = heading_entries(doc)
    if args.pages:
        tmp = os.path.join(os.path.dirname(os.path.abspath(args.docx)), ".render")
        pdf = render_pdf(args.docx, tmp)
        pg = locate_pages(doc, pdf)
        entries = [(l, t, pg.get(t)) for l, t, _ in entries]
        shutil.rmtree(tmp, ignore_errors=True)
    body = list(doc.element.body)
    start = None
    for c in body:
        if c.tag == qn("w:p") and any("TOC" in (i.text or "") for i in c.iter(qn("w:instrText"))):
            start = c
            break
    if start is None:
        fail("לא נמצא שדה תוכן עניינים במסמך")
    end = None
    for c in body[body.index(start):]:
        if c.tag == qn("w:p") and any(f.get(qn("w:fldCharType")) == "end" for f in c.iter(qn("w:fldChar"))):
            end = c
            break
    if end is None:
        fail("שדה תוכן העניינים אינו סגור")
    seg = body[body.index(start): body.index(end) + 1]
    new = toc_paragraphs(b, entries)
    for n in new:
        start.addprevious(n)
    for c in seg:
        c.getparent().remove(c)
    set_update_fields(doc)
    b.fn.save()
    doc.save(args.docx)
    print(f"תוכן העניינים עודכן ({len(entries)} רשומות{', כולל מספרי עמודים מרינדור LibreOffice' if args.pages else ''}). Word יעדכן אותו מחדש בפתיחה.")


# ───────────────────────── check / outline / render ─────────────────────────
def section_text_words(doc, head):
    n = 0
    for c in section_range(doc, head):
        if heading_level(c) is not None and heading_level(c) <= heading_level(head):
            break
        n += len(ptext(c).split())
    return n


def cmd_outline(args):
    doc = load_doc(args.docx)
    print("מבנה המסמך (כותרות, מילים בסעיף הישיר, סטטוס):")
    kids = body_children(doc)
    for i, c in enumerate(kids):
        lvl = heading_level(c)
        if not lvl:
            continue
        direct = []
        for d in kids[i + 1:]:
            if heading_level(d) is not None:
                break
            direct.append(d)
        words = sum(len(ptext(d).split()) for d in direct if not (d.tag == qn("w:p") and is_placeholder_p(d)))
        ph = sum(1 for d in direct if d.tag == qn("w:p") and is_placeholder_p(d))
        ids = [n[4:] for n in bookmark_names(c) if n.startswith("sec_")]
        status = "להשלמה" if ph and not words else ("חלקי" if ph else ("תוכן" if words else "ריק"))
        print(f"{'  ' * (lvl - 1)}- {ptext(c)}  [{','.join(ids) or 'ללא-מזהה'}] {words} מילים · {status}")


def cmd_check(args):
    path = args.docx
    problems, notes = [], []
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        fail("הקובץ לא קיים או ריק")
    try:
        z = zipfile.ZipFile(path)
        bad = z.testzip()
        if bad:
            problems.append("ZIP פגום: " + bad)
        for n in z.namelist():
            if n.endswith(".xml") or n.endswith(".rels"):
                try:
                    etree.fromstring(z.read(n))
                except Exception as e:
                    problems.append(f"XML לא תקין ב-{n}: {e}")
    except zipfile.BadZipFile:
        fail("אינו קובץ DOCX תקין (ZIP)")
    doc = docx.Document(path)
    body = doc.element.body
    paras = [p for p in body.iter(qn("w:p"))]
    nonempty = [p for p in paras if ptext(p).strip()]
    notes.append(f"פסקאות: {len(nonempty)} · טבלאות: {len(doc.tables)} · תמונות: {len(list(body.iter(qn('w:drawing'))))}")
    # RTL
    no_bidi = [ptext(p)[:40] for p in nonempty if HEB.search(ptext(p)) and not (p.find(qn('w:pPr')) is not None and p.find(qn('w:pPr')).find(qn('w:bidi')) is not None) and p.getparent().tag != qn("w:tc")]
    style_bidi = 0
    if no_bidi:
        # ייתכן שהכיווניות מוגדרת בסגנון
        for p in nonempty:
            pass
        problems.append(f"{len(no_bidi)} פסקאות עבריות ללא כיווניות RTL ישירה (למשל: {no_bidi[0]!r}) – בדקו אם הסגנון מגדיר bidi")
    # גופן: גופנים בגוף המסמך ובסגנונות שבשימוש בפועל
    fonts = set()
    used = set()
    for e in body.iter(qn("w:pStyle"), qn("w:rStyle")):
        used.add(e.get(qn("w:val")))
    for r in body.iter(qn("w:rFonts")):
        v = r.get(qn("w:ascii"))
        if v:
            fonts.add(v)
    sty = doc.styles.element
    dd = sty.find(qn("w:docDefaults"))
    if dd is not None:
        for r in dd.iter(qn("w:rFonts")):
            v = r.get(qn("w:ascii"))
            if v:
                fonts.add(v)
    for st_el in sty.findall(qn("w:style")):
        if st_el.get(qn("w:styleId")) in used or st_el.get(qn("w:default")) == "1":
            for r in st_el.iter(qn("w:rFonts")):
                v = r.get(qn("w:ascii"))
                if v:
                    fonts.add(v)
    if len(fonts) > 1:
        problems.append("יותר מגופן אחד בשימוש: " + ", ".join(sorted(fonts)))
    else:
        notes.append("גופן אחיד: " + (next(iter(fonts)) if fonts else "ברירת מחדל"))
    # הערות שוליים
    fn_root = None
    for rel in doc.part.rels.values():
        if rel.reltype == RT.FOOTNOTES:
            fn_root = etree.fromstring(rel.target_part.blob)
    refs = [int(r.get(qn("w:id"))) for r in body.iter(qn("w:footnoteReference"))]
    if fn_root is None:
        notes.append("אין חלק הערות שוליים במסמך")
        defined = set()
    else:
        defined = {int(f.get(qn("w:id"))) for f in fn_root.findall(qn("w:footnote")) if f.get(qn("w:type")) is None}
        empty = [int(f.get(qn("w:id"))) for f in fn_root.findall(qn("w:footnote")) if f.get(qn("w:type")) is None and not "".join(t.text or "" for t in f.iter(qn("w:t"))).strip()]
        if empty:
            problems.append(f"הערות שוליים ריקות: {empty}")
    missing = [r for r in refs if r not in defined]
    orphan = [d for d in defined if d not in refs]
    if missing:
        problems.append(f"הפניות להערות שוליים שאינן מוגדרות: {missing}")
    if orphan:
        problems.append(f"הערות שוליים מוגדרות שאין להן הפניה בגוף: {orphan}")
    notes.append(f"הערות שוליים אמיתיות: {len(refs)} הפניות / {len(defined)} מוגדרות")
    if len(refs) != len(set(refs)):
        problems.append("הפניה כפולה להערת שוליים")
    # שער / תוכן / מספור עמודים / ביבליוגרפיה
    full = "\n".join(ptext(p) for p in nonempty)
    for need in ("תוכן עניינים",):
        if need not in full:
            problems.append("חסר: " + need)
    if not any(True for _ in doc.sections[0].footer._element.iter(qn("w:instrText"))):
        problems.append("אין מספור עמודים בכותרת התחתונה")
    if re.search(r"(?<!\d)\d{9}(?!\d)", full):
        problems.append("נמצא רצף של 9 ספרות (ייתכן מספר זהות) – יש להסיר")
    if args.students:
        notes.append(f"מספר תלמידים מוצהר: {args.students}")
    # סעיפים להשלמה
    pend = [ptext(p)[:60] for p in nonempty if is_placeholder_p(p)]
    notes.append(f"סימוני [להשלמה] פתוחים: {len(pend)}")
    # ביבליוגרפיה מול רישום מקורות
    if args.sources and os.path.exists(args.sources):
        srcs = json.load(open(args.sources, encoding="utf-8"))["sources"]
        head = find_section(doc, "bibliography")
        bib_text = ""
        if head is not None:
            bib_text = " ".join(ptext(c) for c in section_range(doc, head))
        for s in srcs:
            marker = (s.get("title") or "")[:25]
            if s.get("status") in ("approved", "cited-only") and s.get("used_in") and marker and marker not in bib_text:
                problems.append(f"מקור {s['id']} אושר ושימש אך אינו בביבליוגרפיה")
            if s.get("status") in ("proposed", "rejected") and marker and marker in bib_text:
                problems.append(f"מקור {s['id']} בסטטוס {s['status']} מופיע בביבליוגרפיה")
    # אורך חלקים אישיים (הערכה)
    kids = body_children(doc)
    for i, c in enumerate(kids):
        if heading_level(c) and any(n.startswith("sec_lit_p_") for n in bookmark_names(c)):
            lvl = heading_level(c)
            words = 0
            for d in kids[i + 1:]:
                hl = heading_level(d)
                if hl is not None and hl <= lvl:
                    break
                words += len(ptext(d).split())
            fnw = 0
            if words > 750:
                problems.append(f"החלק האישי '{ptext(c)}' כ-{words} מילים – ייתכן שחורג מעמוד וחצי (בדקו עם render)")
            else:
                notes.append(f"חלק אישי '{ptext(c)}': {words} מילים (הערכה: עד עמוד וחצי ≈ 600–750 מילים בגופן 12; לא נבדק עימוד בפועל)")
    print("== בדיקת מבנה ==")
    for n in notes:
        print("  ✔ " + n)
    if problems:
        print("== בעיות ==")
        for p in problems:
            print("  ✘ " + p)
        sys.exit(1)
    print("אין בעיות מבנה שהבדיקה מצאה. (התוכן והאיכות המקצועית לא נבדקים כאן.)")


def cmd_render(args):
    out = args.outdir or os.path.join(os.path.dirname(os.path.abspath(args.docx)), "render")
    pdf = render_pdf(args.docx, out)
    pages = pdf_pages_text(pdf)
    npages = len([p for p in pages if p.strip()])
    subprocess.run(["pdftoppm", "-r", "60", "-png", pdf, os.path.join(out, "page")], check=False)
    print(f"PDF: {pdf} · עמודים: {npages} · תמונות תצוגה: {out}/page-*.png")
    doc = load_doc(args.docx)
    kids = body_children(doc)
    pg = locate_pages(doc, pdf)
    ents = heading_entries(doc)
    for i, (l, t, _) in enumerate(ents):
        if any(re.match(r"^חלק אישי", t) or "מקור" in t for _ in [0]) and l >= 3:
            pass
    # אורך חלקים אישיים לפי עמודים
    personal = [(t, pg.get(t)) for l, t, _ in ents if re.search(r"אישי", t) and pg.get(t)]
    for t, p in personal:
        print(f"  כותרת אישית '{t}' מתחילה בעמוד {p}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    a = sp.add_parser("init"); a.add_argument("dir"); a.add_argument("--topic", default=""); a.add_argument("--students", default=""); a.add_argument("--name", default="work.docx")
    a = sp.add_parser("apply"); a.add_argument("docx"); a.add_argument("ops"); a.add_argument("--no-backup", action="store_true")
    a = sp.add_parser("bibliography"); a.add_argument("docx"); a.add_argument("sources")
    a = sp.add_parser("refresh-toc"); a.add_argument("docx"); a.add_argument("--pages", action="store_true")
    a = sp.add_parser("check"); a.add_argument("docx"); a.add_argument("--sources"); a.add_argument("--students", type=int)
    a = sp.add_parser("outline"); a.add_argument("docx")
    a = sp.add_parser("render"); a.add_argument("docx"); a.add_argument("outdir", nargs="?")
    args = ap.parse_args()
    {"init": cmd_init, "apply": cmd_apply, "bibliography": cmd_bibliography, "refresh-toc": cmd_refresh_toc,
     "check": cmd_check, "outline": cmd_outline, "render": cmd_render}[args.cmd](args)


if __name__ == "__main__":
    main()
