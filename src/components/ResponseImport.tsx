import { useState } from 'react';
import { hasRecognizedHeadings } from '../lib/responseParser';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onParse: () => void;
}

export function ResponseImport({ value, onChange, onParse }: Props) {
  const [attempted, setAttempted] = useState(false);
  const recognized = hasRecognizedHeadings(value);

  return (
    <div className="card">
      <h2>4. הדבקת תשובת ה-AI</h2>
      <p className="help-text">הדביקו כאן את מלוא התשובה שקיבלתם מ-Claude, ולחצו על "פירוק אוטומטי לשדות".</p>
      <div className="field">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="## מטרות&#10;...&#10;&#10;## פתיחה אקטואלית&#10;..."
          style={{ minHeight: 220 }}
        />
      </div>
      {attempted && !recognized && value.trim() && (
        <p className="help-text" style={{ color: 'var(--color-danger)' }}>
          לא זוהו כותרות מוכרות בתשובה. ודאו שהעתקתם את כל התשובה כולל כותרות ה-## , או ערכו ידנית בשלב הבא.
        </p>
      )}
      <button
        className="btn btn-primary"
        disabled={!value.trim()}
        onClick={() => {
          setAttempted(true);
          onParse();
        }}
      >
        פירוק אוטומטי לשדות
      </button>
    </div>
  );
}
