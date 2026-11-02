# פורמט קובץ ה־ops לעדכון המסמך

`python3 scripts/civics_docx.py apply <work.docx> <ops.json>` – קובץ JSON: `{"ops": [ ... ]}`. הפעולות מתבצעות לפי הסדר; אם אחת נכשלת – המסמך לא נשמר (נוצר רק גיבוי ב־`backups/`).

## פעולות
**fill** – מילוי סעיף קיים.
```json
{"op":"fill","section":"problem_formulation","blocks":[ ... ]}
```
- `section`: מזהה (`problem_formulation`, `lit_p_1`, …) או טקסט הכותרת.
- מחליף רק פסקאות `[להשלמה: …]`. אם יש בסעיף תוכן אחר – נכשל, אלא אם `"append": true` (מוסיף בסוף) או – באישור מפורש של המורה בלבד – `"replace_confirmed": true` (מחליף; מסרב לגעת בטבלה/תמונה/הערת שוליים, אלא עם `"allow_destroy": true`).

**add_section** – הוספת סעיף (למשל לכל תלמיד בחלק האישי).
```json
{"op":"add_section","after":"lit_personal","id":"lit_p_1","title":"שם התלמיד/ה","level":3,"placeholder":"סיכום מקור"}
```
מזהי סעיפים אישיים: חלק אישי `lit_p_<n>`; רפלקציה `refl_<n>`. (הבדיקה של אורך חלק אישי מזהה `lit_p_*`.)

**set_cover** – עדכון שער: `{"op":"set_cover","topic":"…","students":["…"]}`.

## בלוקים (ב־`blocks`)
| סוג | דוגמה |
|---|---|
| פסקה | `{"type":"p","text":"טקסט {{fn:הערת שוליים}} ו־**מודגש**"}` |
| כותרת | `{"type":"h","level":3,"text":"…","id":"אופציונלי"}` |
| רשימה | `{"type":"bullets","items":["…"]}` / `{"type":"numbered","items":["…"]}` |
| טבלה | `{"type":"table","header":["…"],"rows":[["…"]],"caption":"טבלה 1: …"}` |
| תמונה | `{"type":"image","path":"../charts/x.png","width_cm":14,"caption":"תרשים 1: … (n=…)","alt":"תיאור לנגישות"}` (נתיב יחסי לקובץ ה־ops) |
| סימון להשלמה | `{"type":"placeholder","text":"…"}` |
| מעבר עמוד | `{"type":"pagebreak"}` |

## סעיפי ברירת המחדל (מזהים)
`problem` › `problem_formulation`, `problem_rationale` • `lit` › `lit_personal`, `lit_group`, `lit_summary` • `practical` › `practical_problem`, `practical_tools`, `practical_choice`, `practical_tool`, `findings`, `findings_summary` • `argument` › `claim`, `reasons_lit`, `reasons_field`, `conclusion`, `solutions`, `solution_choice`, `value` • `product` • `reflection` • `bibliography` • `appendices`.

## ביבליוגרפיה
נבנית מ־`sources.json` (סטטוס `approved`/`cited-only` ועם `used_in`) באמצעות `bibliography`; לא כותבים אותה ידנית.
