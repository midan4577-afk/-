#!/usr/bin/env python3
"""יצירת תרשים עמודות אופקי בעברית (RTL) מנתונים שסופקו בלבד.

שימוש:
  # מתוך ספירות שכבר חושבו (ידנית או מ-analyze_data.py)
  python3 make_chart.py counts --labels "מסכים/ה,לא בטוח/ה,לא מסכים/ה" --values 25,5,10 \
      --title "..." --question "נוסח ההיגד" --respondents 40 --out chart.png [--percent]

  # מתוך עמודה בקובץ CSV/XLSX של תשובות גולמיות (שורה = משיב)
  python3 make_chart.py column --file answers.csv --column "שם העמודה" --out chart.png \
      [--order "ערך1,ערך2,..."] [--multi] [--title "..."] [--percent]

כללים: מציג בסיס חישוב (n) בכל תרשים; אין חשיפת פרטים מזהים; לא ממציא נתונים.
--multi: עמודה מרובת בחירה (ערכים מופרדים בפסיק/נקודה־פסיק); האחוזים הם מתוך המשיבים ועלולים להסתכם ביותר מ־100%.
"""
import argparse
import sys
import textwrap

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from bidi.algorithm import get_display

plt.rcParams["font.family"] = ["DejaVu Sans", "Liberation Sans", "FreeSans"]


_NEEDS_BIDI = None


def _ink(text):
    import io
    import numpy as np

    fig = plt.figure(figsize=(3, 1), dpi=100)
    fig.text(0.05, 0.2, text, fontsize=40, ha="left")
    buf = io.BytesIO()
    fig.savefig(buf, format="png")
    plt.close(fig)
    from PIL import Image

    arr = np.array(Image.open(buf).convert("L")) < 128
    cols = np.where(arr.any(axis=0))[0]
    return arr[:, cols.min(): cols.max() + 1]


def needs_bidi_reorder():
    """בגרסאות matplotlib חדשות הטקסט העברי מסודר ימין־לשמאל אוטומטית; בישנות – צריך get_display.
    בודקים בפועל: מציירים 'אז' ובודקים איזה אות מצוירת בצד שמאל."""
    global _NEEDS_BIDI
    if _NEEDS_BIDI is None:
        import numpy as np

        both, alef, zayin = _ink("אז"), _ink("א"), _ink("ז")
        ink_cols = both.any(axis=0)
        # מוצאים את הרווח שבין שתי האותיות ומפצלים בו
        gaps = [i for i in range(1, len(ink_cols) - 1) if not ink_cols[i]]
        if gaps:
            cut = gaps[len(gaps) // 2]
        else:
            cut = both.shape[1] // 2
        left = both[:, :cut].sum()
        # תצוגה נכונה (RTL): 'ז' משמאל. אם משמאל מצוירת 'א' – צריך get_display.
        _NEEDS_BIDI = abs(left - alef.sum()) < abs(left - zayin.sum())
    return _NEEDS_BIDI


def _disp(line):
    return get_display(line) if needs_bidi_reorder() else line


def he(s, width=None):
    """סדר תצוגה לעברית; שבירת שורות לפני היפוך."""
    if width:
        lines = []
        for part in str(s).split("\n"):
            lines += textwrap.wrap(part, width=width) or [""]
        return "\n".join(_disp(l) for l in lines)
    return _disp(str(s))


def draw(labels, values, title, question, n_resp, out, percent, note=None):
    if len(labels) != len(values):
        sys.exit("מספר התוויות שונה ממספר הערכים")
    if not labels:
        sys.exit("אין נתונים לתרשים")
    total = n_resp if n_resp else sum(values)
    fig_h = max(3.2, 0.7 * len(labels) + 2.2)
    fig, ax = plt.subplots(figsize=(8, fig_h), dpi=160)
    ys = list(range(len(labels)))[::-1]
    shown = [(v / total * 100 if percent and total else v) for v in values]
    bars = ax.barh(ys, shown, color="#2F5D8C", height=0.6)
    ax.set_yticks(ys)
    ax.set_yticklabels([he(l, 28) for l in labels], fontsize=11)
    ax.yaxis.tick_right()
    ax.invert_xaxis()
    mx = max(shown) if shown else 1
    ax.set_xlim(mx * 1.18, 0)
    for b, v, raw in zip(bars, shown, values):
        txt = f"{v:.0f}% ({raw})" if percent else f"{raw}"
        ax.text(b.get_width() + mx * 0.02, b.get_y() + b.get_height() / 2, txt, va="center", ha="right", fontsize=10)
    ax.set_xlabel(he("אחוז מהמשיבים" if percent else "מספר תשובות"), fontsize=10)
    for sp in ("top", "left"):
        ax.spines[sp].set_visible(False)
    t = title or ""
    if question:
        t = (t + "\n" if t else "") + question
    ax.set_title(he(t, 60) if t else "", fontsize=12, pad=12, loc="right")
    foot = f"n = {n_resp}" if n_resp else f"סה\"כ תשובות: {sum(values)}"
    foot = he("בסיס חישוב: " + foot) if n_resp else he(foot)
    if note:
        foot += "\n" + he(note, 90)
    fig.text(0.98, 0.01, foot, ha="right", va="bottom", fontsize=9, color="#444444")
    fig.tight_layout(rect=(0, 0.06, 1, 1))
    fig.savefig(out)
    print("נשמר:", out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="mode", required=True)
    c = sp.add_parser("counts")
    c.add_argument("--labels", required=True)
    c.add_argument("--values", required=True)
    c.add_argument("--respondents", type=int)
    c.add_argument("--note")
    k = sp.add_parser("column")
    k.add_argument("--file", required=True)
    k.add_argument("--column", required=True)
    k.add_argument("--order")
    k.add_argument("--multi", action="store_true")
    k.add_argument("--note")
    for p in (c, k):
        p.add_argument("--title", default="")
        p.add_argument("--question", default="")
        p.add_argument("--out", required=True)
        p.add_argument("--percent", action="store_true")
    a = ap.parse_args()
    if a.mode == "counts":
        labels = [x.strip() for x in a.labels.split(",")]
        values = [float(x) if "." in x else int(x) for x in a.values.split(",")]
        draw(labels, values, a.title, a.question, a.respondents, a.out, a.percent, a.note)
    else:
        import pandas as pd

        df = pd.read_csv(a.file) if a.file.lower().endswith(".csv") else pd.read_excel(a.file)
        if a.column not in df.columns:
            sys.exit("העמודה לא נמצאה. עמודות זמינות: " + " | ".join(map(str, df.columns)))
        col = df[a.column].dropna().astype(str).str.strip()
        n_resp = int(len(col))
        if a.multi:
            items = col.str.split(r"\s*[;,]\s*", regex=True).explode().str.strip()
            counts = items[items != ""].value_counts()
        else:
            counts = col.value_counts()
        if a.order:
            order = [x.strip() for x in a.order.split(",")]
            extra = [i for i in counts.index if i not in order]
            if extra:
                print("אזהרה: ערכים שלא ברשימת --order:", extra, file=sys.stderr)
            counts = counts.reindex(order + extra).fillna(0).astype(int)
        note = a.note or ("מרובת בחירה: האחוזים עשויים להסתכם ביותר מ־100%." if a.multi else None)
        draw([str(i) for i in counts.index], [int(v) for v in counts.values], a.title, a.question, n_resp, a.out, a.percent, note)


if __name__ == "__main__":
    main()
