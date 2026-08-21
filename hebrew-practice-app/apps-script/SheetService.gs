/**
 * SheetService.gs
 * All reading/writing of the spreadsheet lives here. Code.gs (the web
 * entry points) never touches SpreadsheetApp directly.
 */

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheetOrThrow_(name) {
  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) {
    throw new Error('Sheet tab "' + name + '" was not found. Check the tab name.');
  }
  return sheet;
}

/** Active topics only, sorted by topic_name for a stable, friendly list. */
function getActiveTopics() {
  var sheet = getSheetOrThrow_(SHEET_TOPICS);
  var rows = sheetToObjects(sheet, TOPICS_HEADERS);

  var topics = rows
    .filter(function (r) { return toBool(r.active) && safeText(r.topic_id) !== ''; })
    .map(function (r) {
      return {
        topic_id: safeText(r.topic_id),
        topic_name: safeText(r.topic_name),
        questions_per_quiz: toPositiveInt(r.questions_per_quiz, 10)
      };
    });

  topics.sort(function (a, b) { return a.topic_name.localeCompare(b.topic_name, 'he'); });
  return topics;
}

/**
 * All active questions for one topic, in their original sheet order.
 * Shuffling/slicing to questions_per_quiz happens on the frontend so the
 * same fetched set can be re-shuffled without another round trip, and so
 * the backend stays a plain data reader.
 */
function getActiveQuestionsForTopic(topicId) {
  var cleanTopicId = safeText(topicId);
  if (!cleanTopicId) throw new Error('topic_id is required.');

  var topicsSheet = getSheetOrThrow_(SHEET_TOPICS);
  var topicRows = sheetToObjects(topicsSheet, TOPICS_HEADERS);
  var topicRow = topicRows.filter(function (r) {
    return safeText(r.topic_id).toLowerCase() === cleanTopicId.toLowerCase() && toBool(r.active);
  })[0];

  if (!topicRow) {
    throw new Error('Topic "' + cleanTopicId + '" was not found or is not active.');
  }

  var topic = {
    topic_id: safeText(topicRow.topic_id),
    topic_name: safeText(topicRow.topic_name),
    questions_per_quiz: toPositiveInt(topicRow.questions_per_quiz, 10)
  };

  var qSheet = getSheetOrThrow_(SHEET_QUESTIONS);
  var qRows = sheetToObjects(qSheet, QUESTIONS_HEADERS);

  var questions = [];
  qRows.forEach(function (r) {
    if (!toBool(r.active)) return;
    if (safeText(r.topic_id).toLowerCase() !== cleanTopicId.toLowerCase()) return;
    if (questions.length >= MAX_QUESTIONS_PER_REQUEST) return;

    var optionsByKey = {
      a: safeText(r.option_a),
      b: safeText(r.option_b),
      c: safeText(r.option_c),
      d: safeText(r.option_d)
    };

    var correctKey = normalizeCorrectKey(r.correct_answer, optionsByKey);
    var questionText = safeText(r.question_text);
    var questionId = safeText(r.question_id);

    // Defensive: skip malformed rows instead of failing the whole request.
    if (!questionId || !questionText || !correctKey || !optionsByKey[correctKey]) return;

    var options = Object.keys(optionsByKey)
      .filter(function (key) { return optionsByKey[key] !== ''; })
      .map(function (key) { return { key: key, text: optionsByKey[key] }; });

    if (options.length < 2) return; // need at least 2 choices for MCQ

    questions.push({
      question_id: questionId,
      question_text: questionText,
      options: options,
      correct_key: correctKey
    });
  });

  return { topic: topic, questions: questions };
}

/** Appends one row to Results. Returns the generated submission_id. */
function appendQuizResult(payload) {
  var sheet = getSheetOrThrow_(SHEET_RESULTS);
  ensureHeaderRow_(sheet, RESULTS_HEADERS);

  var submissionId = generateSubmissionId();
  var row = [
    new Date(),
    submissionId,
    safeText(payload.student_name),
    safeText(payload.student_id),
    safeText(payload.topic_id),
    safeText(payload.topic_name),
    toPositiveInt(payload.total_questions, 0),
    toPositiveInt(payload.answered_questions, 0) || 0,
    Number(payload.correct_count) || 0,
    Number(payload.wrong_count) || 0,
    Number(payload.unanswered_count) || 0,
    Number(payload.score_percent) || 0,
    safeText(payload.wrong_question_ids),
    // Full JSON blob capped defensively so one bad payload can't blow up a cell.
    JSON.stringify(payload.wrong_question_summaries || []).substring(0, 45000)
  ];

  sheet.appendRow(row);
  return submissionId;
}

/** Writes the header row if the sheet is completely empty. */
function ensureHeaderRow_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
}

/**
 * One-time setup helper for the teacher: run this once from the Apps
 * Script editor (select setupSheets, click Run) to create the three
 * tabs with correct headers and a few sample rows, if they don't
 * already exist. Safe to run more than once — it never overwrites an
 * existing tab.
 */
function setupSheets() {
  var ss = getSpreadsheet_();

  if (!ss.getSheetByName(SHEET_TOPICS)) {
    var topicsSheet = ss.insertSheet(SHEET_TOPICS);
    topicsSheet.appendRow(TOPICS_HEADERS);
    topicsSheet.appendRow(['t1', 'שברים', 5, true]);
    topicsSheet.appendRow(['t2', 'דקדוק - שמות עצם', 5, true]);
    topicsSheet.getRange(1, 1, 1, TOPICS_HEADERS.length).setFontWeight('bold');
    topicsSheet.setFrozenRows(1);
  }

  if (!ss.getSheetByName(SHEET_QUESTIONS)) {
    var qSheet = ss.insertSheet(SHEET_QUESTIONS);
    qSheet.appendRow(QUESTIONS_HEADERS);
    qSheet.appendRow(['q1', 't1', 'כמה זה 1/2 + 1/4?', '3/4', '2/6', '1/6', '2/4', 'a', true]);
    qSheet.appendRow(['q2', 't1', 'כמה זה 1/3 + 1/3?', '1/6', '2/3', '2/9', '1/3', 'b', true]);
    qSheet.getRange(1, 1, 1, QUESTIONS_HEADERS.length).setFontWeight('bold');
    qSheet.setFrozenRows(1);
  }

  if (!ss.getSheetByName(SHEET_RESULTS)) {
    var resultsSheet = ss.insertSheet(SHEET_RESULTS);
    resultsSheet.appendRow(RESULTS_HEADERS);
    resultsSheet.getRange(1, 1, 1, RESULTS_HEADERS.length).setFontWeight('bold');
    resultsSheet.setFrozenRows(1);
  }

  SpreadsheetApp.flush();
  Logger.log('Setup complete. Tabs verified: Topics, Questions, Results.');
}
