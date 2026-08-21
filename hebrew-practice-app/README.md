# תרגול לתלמידים — Hebrew Student Practice App (MVP)

A simple, low-cost, **non-AI** multiple-choice practice/quiz system for a
teacher's students. Google Sheets is the content-management layer;
Google Apps Script is the backend/API; the frontend is static HTML/CSS/JS
with full Hebrew RTL support.

No student accounts, no passwords, no timer, no difficulty levels, no AI.
Just: enter name + ID → pick a topic → answer questions one at a time →
see score and a review of what was missed. The teacher edits everything
(topics, question counts, the question bank) directly in the spreadsheet.

## Project layout

```
hebrew-practice-app/
├── apps-script/          # Backend — paste into the Apps Script editor
│   ├── Code.gs            # doGet / doPost web app entry points
│   ├── Config.gs           # sheet/column name constants
│   ├── SheetService.gs      # all spreadsheet reads/writes
│   └── Utils.gs              # small shared helpers
├── frontend/              # Static site — host anywhere, or open locally
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── config.js        # <- paste your Web App URL here
│       ├── api.js
│       ├── validation.js
│       ├── quiz.js
│       ├── ui.js
│       └── app.js
├── sheets/                # Example schema + Hebrew seed data (CSV, importable)
│   ├── Topics.csv
│   ├── Questions.csv
│   └── Results_headers.csv
└── SETUP_GUIDE.md         # Full non-technical setup walkthrough
```

## Quick start

See **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** for the full step-by-step guide
(written for a non-technical teacher). Short version:

1. Create a Google Sheet, open **Extensions ⟶ Apps Script**, paste in the
   4 files from `apps-script/`, run `setupSheets` once (creates the tabs
   + sample data).
2. **Deploy ⟶ New deployment ⟶ Web app**, execute as **Me**, access
   **Anyone**, copy the resulting URL.
3. Paste that URL into `frontend/js/config.js` (`API_URL`).
4. Open `frontend/index.html` (or host the `frontend/` folder anywhere
   static — GitHub Pages, Netlify, etc.).

## Data model

| Sheet | Purpose |
|---|---|
| `Topics` | `topic_id, topic_name, questions_per_quiz, active` — one row per topic. |
| `Questions` | `question_id, topic_id, question_text, option_a..d, correct_answer, active` — the question bank. |
| `Results` | `timestamp, submission_id, student_name, student_id, topic_id, topic_name, total_questions, answered_questions, correct_count, wrong_count, unanswered_count, score_percent, wrong_question_ids, wrong_question_summaries_json` — one row per completed attempt. |

`correct_answer` is stored as the option **letter** (`a`/`b`/`c`/`d`), not a
position — so it stays correct after the frontend shuffles the options
for display. The teacher can also type the option's exact text instead
of a letter if that's more comfortable.

## Design notes / intentional MVP limits

- **Client-side scoring.** The frontend receives the correct answer key
  and grades the attempt in the browser; the backend just logs the
  result. This is appropriate for low-stakes practice (per the spec) and
  keeps the backend to 4 small files with no session/auth logic.
- **No auth.** Name + Israeli ID (validated with the standard checksum)
  identify the student in the Results sheet only — they are not
  credentials.
- **CORS workaround.** Apps Script Web Apps don't support CORS preflight
  (OPTIONS) requests. `api.js` sends `GET` for reads and `POST` with
  `Content-Type: text/plain` (containing a JSON string body) for writes,
  which browsers treat as "simple requests" that skip preflight entirely.
