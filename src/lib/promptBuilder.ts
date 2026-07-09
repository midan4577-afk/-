import type { LessonMaterials } from '../types';

export interface PromptInput {
  topicTitle: string;
  topicDescription?: string;
  goalsHint?: string;
  skillsHint?: string;
  materials: LessonMaterials;
}

/** Fixed markdown headings the response parser looks for. Keep in sync with parseAiResponse. */
export const RESPONSE_HEADINGS = {
  goals: 'מטרות',
  skills: 'מיומנויות',
  currentEventOpening: 'פתיחה אקטואלית',
  guidingQuestions: 'שאלות מנחות',
  lessonStages: 'שלבי השיעור',
  academicAdaptation: 'התאמה לכיתה עיונית',
  strugglingAdaptation: 'התאמה לכיתה מתקשה',
  summary: 'סיכום',
  homework: 'שיעורי בית',
  assessment: 'הערכה',
} as const;

function buildMaterialsSection(materials: LessonMaterials): string {
  const parts: string[] = [];
  if (materials.pastedText.trim()) {
    parts.push(`### טקסט שהמורה הדביק\n${materials.pastedText.trim()}`);
  }
  for (const file of materials.fileExcerpts) {
    if (file.text.trim()) {
      parts.push(`### תוכן מהקובץ "${file.fileName}"\n${file.text.trim()}`);
    }
  }
  if (materials.linkNotes.trim()) {
    parts.push(`### קישורים שסיפק המורה (סרטון/כתבה)\n${materials.linkNotes.trim()}\nהערה: לא בוצעה הבאה אוטומטית של תוכן הקישור — התייחס אליו רק לפי הכתובת/התיאור שסופק, ואל תמציא תוכן שלא ניתן.`);
  }
  if (parts.length === 0) {
    return 'המורה לא צירף חומרי גלם נוספים. בסס את מערך השיעור על הנושא ועל אירוע אקטואלי רלוונטי שאתה בוחר.';
  }
  return parts.join('\n\n');
}

export function buildLessonPrompt(input: PromptInput): string {
  const { topicTitle, topicDescription, goalsHint, skillsHint, materials } = input;

  return `אתה מומחה להוראת אזרחות בבתי ספר תיכוניים בישראל, ובונה עבורי מערך שיעור מלא בעברית.

## נושא השיעור
${topicTitle}${topicDescription ? `\n${topicDescription}` : ''}

${goalsHint ? `## מטרות מוצעות (השתמש כבסיס, ניתן להרחיב)\n${goalsHint}\n` : ''}
${skillsHint ? `## מיומנויות מוצעות (השתמש כבסיס, ניתן להרחיב)\n${skillsHint}\n` : ''}

## חומרי גלם שסיפק המורה
${buildMaterialsSection(materials)}

## עקרון פדגוגי מרכזי — חובה להטמיע בכל התרגולים
אזרחות היא "שפה". תלמידים נבחנים בעיקר על יכולת "ניתוח אירוע", לפי שיטה קבועה בת 4 שלבים:
1. זיהוי המושג המרכזי החבוי בשאלה/באירוע.
2. הצגת ההגדרה המדויקת והמלאה של המושג.
3. איתור ציטוט מדויק מתוך הטקסט/האירוע, המצביע על אחד ממרכיבי המושג.
4. קישור מפורש בין המושג לציטוט — לא הצגה נפרדת של השניים, אלא משפט המסביר במפורש כיצד הציטוט מבטא את המושג.

הקושי המרכזי של תלמידים, ובייחוד בכיתות מתקשות, הוא לא זיהוי המושג (זה בדרך כלל מצליח) אלא **ניסוח התשובה המלאה המקשרת בין המושג לציטוט**. לכן בכל תרגיל הכולל ניתוח אירוע, בנה פיגומים (scaffolding) שממוקדים בדיוק בשלב הניסוח הזה: משפטי גשר לדוגמה, מבנה תשובה קבוע, ומילות קישור מוצעות.

## דרישת התאמה אמיתית לשונות — חובה
אל תסתפק בהערת "התאמה" כללית. עבור **כל** שלב תרגול (ובמיוחד שלב הניסוח מושג+ציטוט), כתוב שני נוסחים נפרדים ומלאים:
- נוסח לכיתה עיונית: שפה עשירה יותר, דרישה לניתוח עצמאי, ציטוטים ארוכים יותר, פחות פיגומים.
- נוסח לכיתה מתקשה: משפטי גשר מוכנים מראש ("המושג X בא לידי ביטוי בציטוט כי..."), טבלת מושג-ציטוט למילוי, ציטוטים קצרים וממוקדים, שאלות מכוונות בשלבים קטנים יותר.
שני הנוסחים חייבים להיות תוכן שונה בפועל, לא רק הערה בסוגריים.

## דרישת פתיחה באירוע אקטואלי — חובה
פתח את השיעור באירוע אקטואלי אמיתי ומעורר מחשבה (מהשנים האחרונות, רלוונטי לנושא). ציין את שם האירוע/הסיטואציה בקצרה, ולאחריו שאלות מנחות לדיון פתיחה שנוגעות גם בהיבט הרגשי/ערכי וגם בהיבט החוקי/משפטי של האירוע.

## פורמט הפלט — חובה להשתמש בדיוק בכותרות ה-markdown הבאות, בסדר הזה, כל אחת בשורה נפרדת המתחילה ב-"## "
## ${RESPONSE_HEADINGS.goals}
(רשימת מטרות השיעור)

## ${RESPONSE_HEADINGS.skills}
(רשימת מיומנויות נלמדות)

## ${RESPONSE_HEADINGS.currentEventOpening}
(תיאור האירוע האקטואלי הפותח את השיעור)

## ${RESPONSE_HEADINGS.guidingQuestions}
(שאלות מנחות לדיון הפתיחה — רגשיות ומשפטיות)

## ${RESPONSE_HEADINGS.lessonStages}
(שלבי השיעור המפורטים, כולל תרגילי ניתוח אירוע לפי שיטת 4 השלבים)

## ${RESPONSE_HEADINGS.academicAdaptation}
(נוסח מלא ונפרד לכיתה עיונית עבור שלבי התרגול, ובמיוחד שלב הניסוח מושג+ציטוט)

## ${RESPONSE_HEADINGS.strugglingAdaptation}
(נוסח מלא ונפרד לכיתה מתקשה עבור שלבי התרגול, כולל משפטי גשר מוכנים ופיגומים, ובמיוחד שלב הניסוח מושג+ציטוט)

## ${RESPONSE_HEADINGS.summary}
(סיכום השיעור)

## ${RESPONSE_HEADINGS.homework}
(שיעורי בית)

## ${RESPONSE_HEADINGS.assessment}
(דרכי הערכה, כולל מחוון קצר לתשובת מושג+ציטוט)

אנא כתוב את כל התוכן בעברית תקנית, ברורה ומדויקת מבחינה משפטית-אזרחית.`;
}
