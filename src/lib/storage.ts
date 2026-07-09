import type { LessonPlan } from '../types';

const STORAGE_KEY = 'civics-lesson-plans';

function readAll(): LessonPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(plans: LessonPlan[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

export function listLessonPlans(): LessonPlan[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getLessonPlan(id: string): LessonPlan | undefined {
  return readAll().find((p) => p.id === id);
}

export function saveLessonPlan(plan: LessonPlan): void {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === plan.id);
  const updated = { ...plan, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.push(updated);
  }
  writeAll(all);
}

export function deleteLessonPlan(id: string): void {
  writeAll(readAll().filter((p) => p.id !== id));
}

export function duplicateLessonPlan(id: string): LessonPlan | undefined {
  const original = getLessonPlan(id);
  if (!original) return undefined;
  const now = new Date().toISOString();
  const copy: LessonPlan = {
    ...original,
    id: crypto.randomUUID(),
    title: `${original.title} (עותק)`,
    createdAt: now,
    updatedAt: now,
  };
  const all = readAll();
  all.push(copy);
  writeAll(all);
  return copy;
}

export function searchLessonPlans(query: string): LessonPlan[] {
  const q = query.trim().toLowerCase();
  if (!q) return listLessonPlans();
  return listLessonPlans().filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.topicTitle.toLowerCase().includes(q) ||
      p.content.goals.toLowerCase().includes(q),
  );
}

export function createEmptyLessonPlan(): LessonPlan {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: 'מערך שיעור חדש',
    topicId: null,
    topicTitle: '',
    createdAt: now,
    updatedAt: now,
    materials: { pastedText: '', fileExcerpts: [], linkNotes: '' },
    rawAiResponse: '',
    content: {
      goals: '',
      skills: '',
      currentEventOpening: '',
      guidingQuestions: '',
      lessonStages: '',
      academicAdaptation: '',
      strugglingAdaptation: '',
      summary: '',
      homework: '',
      assessment: '',
    },
  };
}
