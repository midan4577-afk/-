import { useState } from 'react';

interface Props {
  prompt: string;
}

export function PromptPanel({ prompt }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="card">
      <h2>3. הפרומפט המוכן</h2>
      <p className="help-text">
        העתיקו את הפרומפט, הדביקו אותו בשיחה עם Claude (claude.ai), ולאחר קבלת התשובה — העתיקו את כל התשובה
        בחזרה לתיבה בשלב הבא.
      </p>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={handleCopy}>
          {copied ? '✓ הועתק ללוח' : 'העתקת הפרומפט'}
        </button>
        <a className="btn" href="https://claude.ai/new" target="_blank" rel="noreferrer">
          פתיחת Claude.ai בכרטיסייה חדשה
        </a>
      </div>
      <div className="prompt-box">{prompt}</div>
    </div>
  );
}
