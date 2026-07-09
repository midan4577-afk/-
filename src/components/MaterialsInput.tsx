import { useRef, useState } from 'react';
import type { LessonMaterials } from '../types';
import { extractTextFromFile } from '../lib/fileExtract';

interface Props {
  materials: LessonMaterials;
  onChange: (materials: LessonMaterials) => void;
  goalsHint: string;
  skillsHint: string;
  onGoalsHintChange: (v: string) => void;
  onSkillsHintChange: (v: string) => void;
}

export function MaterialsInput({
  materials,
  onChange,
  goalsHint,
  skillsHint,
  onGoalsHintChange,
  onSkillsHintChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState('');

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setLoadingFiles(true);
    setError('');
    try {
      const newExcerpts = [...materials.fileExcerpts];
      for (const file of Array.from(fileList)) {
        const extracted = await extractTextFromFile(file);
        newExcerpts.push(extracted);
      }
      onChange({ ...materials, fileExcerpts: newExcerpts });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeFile(fileName: string) {
    onChange({ ...materials, fileExcerpts: materials.fileExcerpts.filter((f) => f.fileName !== fileName) });
  }

  return (
    <div className="card">
      <h2>2. מטרות, מיומנויות וחומרי גלם</h2>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="goals-hint">מטרות (רשות — ישמשו כבסיס לפרומפט)</label>
          <textarea
            id="goals-hint"
            value={goalsHint}
            onChange={(e) => onGoalsHintChange(e.target.value)}
            placeholder="כל מטרה בשורה נפרדת"
          />
        </div>
        <div className="field">
          <label htmlFor="skills-hint">מיומנויות (רשות)</label>
          <textarea
            id="skills-hint"
            value={skillsHint}
            onChange={(e) => onSkillsHintChange(e.target.value)}
            placeholder="כל מיומנות בשורה נפרדת"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="pasted-text">הדבקת טקסט חופשי (מקור, קטע קריאה, סיפור אירוע)</label>
        <textarea
          id="pasted-text"
          value={materials.pastedText}
          onChange={(e) => onChange({ ...materials, pastedText: e.target.value })}
          placeholder="הדביקו כאן טקסט רלוונטי לשיעור..."
          style={{ minHeight: 140 }}
        />
      </div>

      <div className="field">
        <label>העלאת קובץ (PDF / Word / טקסט)</label>
        <div className="file-drop">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
          />
          {loadingFiles && <p className="help-text">מעבד קבצים...</p>}
          {error && <p className="help-text" style={{ color: 'var(--color-danger)' }}>{error}</p>}
        </div>
        {materials.fileExcerpts.length > 0 && (
          <div className="file-list">
            {materials.fileExcerpts.map((f) => (
              <div className="file-chip" key={f.fileName}>
                <span>{f.fileName} ({f.text.length.toLocaleString('he-IL')} תווים)</span>
                <button className="btn" style={{ padding: '2px 8px' }} onClick={() => removeFile(f.fileName)}>
                  הסרה
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="link-notes">קישור לסרטון יוטיוב / כתבה (רק כטקסט — ללא הבאת תוכן אוטומטית)</label>
        <input
          id="link-notes"
          type="text"
          value={materials.linkNotes}
          onChange={(e) => onChange({ ...materials, linkNotes: e.target.value })}
          placeholder="https://... (ואפשר להוסיף תיאור קצר של התוכן)"
        />
        <p className="help-text">שלב 2 עתידי: חיפוש והבאה אוטומטית של סרטונים וכתבות. כרגע מצרפים רק כתובת/תיאור.</p>
      </div>
    </div>
  );
}
