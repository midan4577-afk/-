/**
 * Config.gs
 * All sheet/tab names and column headers live here so the rest of the
 * code never hardcodes a string literal for a sheet or column name.
 * If a teacher renames a tab, update it here only.
 */

var SHEET_TOPICS = 'Topics';
var SHEET_QUESTIONS = 'Questions';
var SHEET_RESULTS = 'Results';

// Expected header names (must match row 1 of each tab exactly).
var TOPICS_HEADERS = ['topic_id', 'topic_name', 'questions_per_quiz', 'active'];

var QUESTIONS_HEADERS = [
  'question_id', 'topic_id', 'question_text',
  'option_a', 'option_b', 'option_c', 'option_d',
  'correct_answer', 'active'
];

var RESULTS_HEADERS = [
  'timestamp', 'submission_id', 'student_name', 'student_id',
  'topic_id', 'topic_name', 'total_questions', 'answered_questions',
  'correct_count', 'wrong_count', 'unanswered_count', 'score_percent',
  'wrong_question_ids', 'wrong_question_summaries_json'
];

// Simple defensive caps so one malformed/malicious request can't
// write a huge row into the sheet.
var MAX_TEXT_LEN = 500;
var MAX_QUESTIONS_PER_REQUEST = 200;
