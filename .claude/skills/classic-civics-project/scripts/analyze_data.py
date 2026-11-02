#!/usr/bin/env python3
"""בדיקת איכות נתוני שאלון (CSV/XLSX, למשל ייצוא Google Forms) לפני ניתוח.

שימוש:
  python3 analyze_data.py <file.csv|xlsx> [--students N] [--sheet NAME]

מדפיס: מספר משיבים, דרישת המחוון (30 מינימום; 10 שאלונים לתלמיד), נתונים חסרים לכל עמודה,
עמודות שנראות כמזהות (יש להוציא מהעבודה), עמודות מרובות בחירה (אחוזים >100%), וספירות לכל שאלה.
לא מסיק מובהקות סטטיסטית ואינו מייצג אוכלוסייה.
"""
import argparse
import re
import sys

import pandas as pd

ID_HINTS = re.compile(r"(שם|מייל|דוא|email|e-mail|טלפון|נייד|phone|זהות|ת\.?ז|כתובת|address|timestamp|חותמת)", re.I)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--students", type=int)
    ap.add_argument("--sheet")
    a = ap.parse_args()
    if a.file.lower().endswith(".csv"):
        df = pd.read_csv(a.file)
    else:
        df = pd.read_excel(a.file, sheet_name=a.sheet or 0)
    n = len(df)
    print(f"# בדיקת נתונים: {a.file}\n")
    print(f"- שורות (משיבים): **{n}** · עמודות: {len(df.columns)}")
    if a.students:
        need = max(30, 10 * a.students)
        print(f"- דרישת המחוון: מינימום 30 שאלונים; לפי {a.students} תלמידים (10 לכל תלמיד): **{need}**. "
              + ("✔ הושגה." if n >= need else f"✘ חסרים {need - n}." ))
    elif n < 30:
        print("- ✘ פחות מ־30 שאלונים (מינימום המחוון).")
    dups = int(df.duplicated().sum())
    if dups:
        print(f"- ⚠ {dups} שורות זהות לחלוטין – לבדוק אם אלו כפילויות או משיבים שענו אותו דבר.")
    print("\n## עמודות שנראות מזהות (להוציא מהעבודה ומהתרשימים)\n")
    ids = [c for c in df.columns if ID_HINTS.search(str(c))]
    print("\n".join(f"- {c}" for c in ids) or "- לא זוהו")
    print("\n## נתונים חסרים וספירות לכל שאלה\n")
    for c in df.columns:
        if c in ids:
            continue
        col = df[c]
        miss = int(col.isna().sum())
        ans = int(col.notna().sum())
        print(f"### {c}\n- משיבים על השאלה: {ans} מתוך {n}" + (f" · חסרים: {miss}" if miss else ""))
        s = col.dropna().astype(str).str.strip()
        if s.empty:
            continue
        multi = s.str.contains(r"[;,]").mean() > 0.3 and s.str.len().mean() < 120
        uniq = s.nunique()
        if uniq > 15 and not multi:
            print(f"- שאלה פתוחה / ערכים רבים ({uniq} שונים) – לנתח איכותנית; לא להציג אחוזים.")
            continue
        if multi:
            items = s.str.split(r"\s*[;,]\s*", regex=True).explode().str.strip()
            vc = items.value_counts()
            print(f"- ⚠ נראית מרובת בחירה: סה\"כ בחירות {int(vc.sum())} ממשיבים {ans}; האחוזים (מתוך משיבים) עשויים לעבור 100%.")
            for k, v in vc.items():
                print(f"  - {k}: {v} ({v / ans * 100:.0f}% מהמשיבים)")
        else:
            vc = s.value_counts()
            for k, v in vc.items():
                print(f"  - {k}: {v} ({v / ans * 100:.0f}%)")
        print()
    print("\n## תזכורות\n- מדגם נוחות אינו מייצג את כלל האוכלוסייה.\n- אין להסיק סיבתיות או מובהקות סטטיסטית מהנתונים האלה.\n- אחוזים מעוגלים אינם נתונים גולמיים.")


if __name__ == "__main__":
    sys.exit(main())
