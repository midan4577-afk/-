import type { LessonPlan } from '../types';
import { downloadLessonPlanAsWord } from '../lib/exportHtml';

interface Props {
  plan: LessonPlan;
}

const SECTIONS: { field: keyof LessonPlan['content']; heading: string }[] = [
  { field: 'goals', heading: 'מטרות' },
  { field: 'skills', heading: 'מיומנויות' },
  { field: 'currentEventOpening', heading: 'פתיחה אקטואלית' },
  { field: 'guidingQuestions', heading: 'שאלות מנחות' },
  { field: 'lessonStages', heading: 'שלבי השיעור' },
  { field: 'academicAdaptation', heading: 'התאמה לכיתה עיונית' },
  { field: 'strugglingAdaptation', heading: 'התאמה לכיתה מתקשה' },
  { field: 'summary', heading: 'סיכום' },
  { field: 'homework', heading: 'שיעורי בית' },
  { field: 'assessment', heading: 'הערכה' },
];

export function PrintPreview({ plan }: Props) {
  return (
    <div>
      <div className="toolbar no-print">
        <button className="btn btn-primary" onClick={() => window.print()}>
          הדפסה / שמירה כ-PDF
        </button>
        <button className="btn" onClick={() => downloadLessonPlanAsWord(plan)}>
          ייצוא ל-Word
        </button>
      </div>
      <div className="print-preview">
        <h1>{plan.title}</h1>
        <div className="subtitle">נושא: {plan.topicTitle || 'ללא נושא מוגדר'}</div>
        {SECTIONS.map(({ field, heading }) => (
          <section key={field}>
            <h2>{heading}</h2>
            <pre>{plan.content[field]?.trim() || '— לא הוזן —'}</pre>
          </section>
        ))}
      </div>
    </div>
  );
}
