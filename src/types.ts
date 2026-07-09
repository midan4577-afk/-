export interface CivicsTopic {
  id: string;
  title: string;
  description: string;
  suggestedGoals: string[];
  suggestedSkills: string[];
}

export type ClassLevel = 'עיונית' | 'מתקשה';

export interface LessonMaterials {
  pastedText: string;
  fileExcerpts: { fileName: string; text: string }[];
  linkNotes: string; // free-text: youtube/article links, not fetched automatically
}

/** Structured fields parsed from the AI's markdown response, editable afterwards. */
export interface LessonPlanContent {
  goals: string;
  skills: string;
  currentEventOpening: string;
  guidingQuestions: string;
  lessonStages: string;
  academicAdaptation: string;
  strugglingAdaptation: string;
  summary: string;
  homework: string;
  assessment: string;
}

export const EMPTY_CONTENT: LessonPlanContent = {
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
};

export interface LessonPlan {
  id: string;
  title: string;
  topicId: string | null;
  topicTitle: string;
  createdAt: string;
  updatedAt: string;
  materials: LessonMaterials;
  rawAiResponse: string;
  content: LessonPlanContent;
}
