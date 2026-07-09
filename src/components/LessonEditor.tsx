import type { LessonPlan, LessonPlanContent } from '../types';

interface Props {
  plan: LessonPlan;
  onChange: (plan: LessonPlan) => void;
}

const FIELD_LABELS: { field: keyof LessonPlanContent; label: string }[] = [
  { field: 'goals', label: 'מטרות' },
  { field: 'skills', label: 'מיומנויות' },
  { field: 'currentEventOpening', label: 'פתיחה אקטואלית' },
  { field: 'guidingQuestions', label: 'שאלות מנחות' },
  { field: 'lessonStages', label: 'שלבי השיעור' },
  { field: 'summary', label: 'סיכום' },
  { field: 'homework', label: 'שיעורי בית' },
  { field: 'assessment', label: 'הערכה' },
];

export function LessonEditor({ plan, onChange }: Props) {
  function updateField(field: keyof LessonPlanContent, value: string) {
    onChange({ ...plan, content: { ...plan.content, [field]: value } });
  }

  return (
    <div>
      <div className="card">
        <h2>פרטי מערך השיעור</h2>
        <div className="field">
          <label htmlFor="plan-title">כותרת</label>
          <input
            id="plan-title"
            type="text"
            value={plan.title}
            onChange={(e) => onChange({ ...plan, title: e.target.value })}
          />
        </div>
      </div>

      <div className="card">
        <h2>שדות כלליים</h2>
        {FIELD_LABELS.map(({ field, label }) => (
          <div className="field" key={field}>
            <label htmlFor={`field-${field}`}>{label}</label>
            <textarea
              id={`field-${field}`}
              value={plan.content[field]}
              onChange={(e) => updateField(field, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="card">
        <h2>התאמה לשונות — ניסוח מושג + ציטוט</h2>
        <div className="split-columns">
          <div className="field column-academic">
            <label htmlFor="academic-adaptation">כיתה עיונית</label>
            <textarea
              id="academic-adaptation"
              value={plan.content.academicAdaptation}
              onChange={(e) => updateField('academicAdaptation', e.target.value)}
              style={{ minHeight: 220 }}
            />
          </div>
          <div className="field column-struggling">
            <label htmlFor="struggling-adaptation">כיתה מתקשה</label>
            <textarea
              id="struggling-adaptation"
              value={plan.content.strugglingAdaptation}
              onChange={(e) => updateField('strugglingAdaptation', e.target.value)}
              style={{ minHeight: 220 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
