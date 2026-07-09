import { RESPONSE_HEADINGS } from './promptBuilder';
import type { LessonPlanContent } from '../types';

const FIELD_BY_HEADING: Record<string, keyof LessonPlanContent> = Object.fromEntries(
  Object.entries(RESPONSE_HEADINGS).map(([field, heading]) => [normalizeHeading(heading), field as keyof LessonPlanContent]),
);

function normalizeHeading(text: string): string {
  return text.trim().replace(/[:\s]+$/, '');
}

/**
 * Parses an AI markdown response with "## <heading>" sections into structured fields.
 * Unrecognized headings are ignored; missing headings leave the field untouched.
 */
export function parseAiResponse(raw: string): Partial<LessonPlanContent> {
  const result: Partial<LessonPlanContent> = {};
  if (!raw.trim()) return result;

  const lines = raw.split(/\r?\n/);
  let currentField: keyof LessonPlanContent | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentField) {
      result[currentField] = buffer.join('\n').trim();
    }
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.*)$/);
    if (headingMatch) {
      const heading = normalizeHeading(headingMatch[1]);
      const field = FIELD_BY_HEADING[heading];
      if (field) {
        flush();
        currentField = field;
        continue;
      }
    }
    if (currentField) {
      buffer.push(line);
    }
  }
  flush();

  return result;
}

export function hasRecognizedHeadings(raw: string): boolean {
  return Object.keys(parseAiResponse(raw)).length > 0;
}
