import type { LessonPlan } from '../types';
import { RESPONSE_HEADINGS } from './promptBuilder';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toHtmlParagraphs(text: string): string {
  if (!text.trim()) return '<p style="color:#888">— לא הוזן —</p>';
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
}

const SECTION_ORDER: { field: keyof LessonPlan['content']; heading: string }[] = [
  { field: 'goals', heading: RESPONSE_HEADINGS.goals },
  { field: 'skills', heading: RESPONSE_HEADINGS.skills },
  { field: 'currentEventOpening', heading: RESPONSE_HEADINGS.currentEventOpening },
  { field: 'guidingQuestions', heading: RESPONSE_HEADINGS.guidingQuestions },
  { field: 'lessonStages', heading: RESPONSE_HEADINGS.lessonStages },
  { field: 'academicAdaptation', heading: RESPONSE_HEADINGS.academicAdaptation },
  { field: 'strugglingAdaptation', heading: RESPONSE_HEADINGS.strugglingAdaptation },
  { field: 'summary', heading: RESPONSE_HEADINGS.summary },
  { field: 'homework', heading: RESPONSE_HEADINGS.homework },
  { field: 'assessment', heading: RESPONSE_HEADINGS.assessment },
];

export function lessonPlanToHtml(plan: LessonPlan): string {
  const sections = SECTION_ORDER.map(
    ({ field, heading }) => `<h2>${escapeHtml(heading)}</h2>\n${toHtmlParagraphs(plan.content[field])}`,
  ).join('\n');

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(plan.title)}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; direction: rtl; text-align: right; line-height: 1.7; color: #222; padding: 30px; }
  h1 { color: #143f33; margin-bottom: 4px; }
  h2 { color: #143f33; border-bottom: 2px solid #ddd7c9; padding-bottom: 4px; margin-top: 28px; }
  .subtitle { color: #6b6355; margin-bottom: 24px; }
</style>
</head>
<body>
<h1>${escapeHtml(plan.title)}</h1>
<div class="subtitle">נושא: ${escapeHtml(plan.topicTitle || 'ללא נושא מוגדר')}</div>
${sections}
</body>
</html>`;
}

export function downloadLessonPlanAsWord(plan: LessonPlan): void {
  const html = lessonPlanToHtml(plan);
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${plan.title || 'מערך-שיעור'}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
