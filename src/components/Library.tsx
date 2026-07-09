import { useMemo, useState } from 'react';
import type { LessonPlan } from '../types';

interface Props {
  plans: LessonPlan[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function Library({ plans, onOpen, onCreate, onDelete, onDuplicate }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter(
      (p) => p.title.toLowerCase().includes(q) || p.topicTitle.toLowerCase().includes(q),
    );
  }, [plans, query]);

  return (
    <div>
      <div className="toolbar">
        <input
          type="text"
          placeholder="חיפוש מערכי שיעור..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}
        />
        <button className="btn btn-primary" onClick={onCreate}>
          + מערך שיעור חדש
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state card">
          {plans.length === 0 ? (
            <>
              <p>עדיין אין מערכי שיעור שמורים.</p>
              <button className="btn btn-primary" onClick={onCreate}>
                בניית מערך שיעור ראשון
              </button>
            </>
          ) : (
            <p>לא נמצאו תוצאות עבור "{query}"</p>
          )}
        </div>
      ) : (
        <div className="library-list">
          {filtered.map((plan) => (
            <div className="library-item" key={plan.id}>
              <div className="library-item-main">
                <strong>{plan.title}</strong>
                <span className="meta">
                  {plan.topicTitle && <span className="pill">{plan.topicTitle}</span>}
                  עודכן {formatDate(plan.updatedAt)}
                </span>
              </div>
              <div className="library-item-actions">
                <button className="btn" onClick={() => onOpen(plan.id)}>
                  פתיחה
                </button>
                <button className="btn" onClick={() => onDuplicate(plan.id)}>
                  שכפול
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    if (confirm(`למחוק את "${plan.title}"?`)) onDelete(plan.id);
                  }}
                >
                  מחיקה
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
