/**
 * Code.gs
 * Web app entry points only. Deploy this project as a Web App
 * (see SETUP_GUIDE.md). All real logic lives in SheetService.gs.
 *
 * Endpoints:
 *   GET  ?action=topics
 *   GET  ?action=questions&topic_id=XXX
 *   POST body: JSON string { action: "submitResult", payload: {...} }
 *
 * The frontend sends POST as Content-Type: text/plain to keep it a
 * CORS "simple request" — Apps Script does not support the OPTIONS
 * preflight browsers would otherwise send for a JSON content type.
 */

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = safeText(params.action);

    if (action === 'topics') {
      return jsonResponse({ ok: true, topics: getActiveTopics() });
    }

    if (action === 'questions') {
      var result = getActiveQuestionsForTopic(params.topic_id);
      return jsonResponse({ ok: true, topic: result.topic, questions: result.questions });
    }

    return errorResponse('Unknown or missing action. Use ?action=topics or ?action=questions&topic_id=...');
  } catch (err) {
    return errorResponse(err && err.message ? err.message : err);
  }
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    if (!raw) return errorResponse('Missing request body.');

    var body = JSON.parse(raw);
    var action = safeText(body.action);

    if (action === 'submitResult') {
      var payload = body.payload || {};
      validateResultPayload_(payload);
      var submissionId = appendQuizResult(payload);
      return jsonResponse({ ok: true, submission_id: submissionId });
    }

    return errorResponse('Unknown or missing action.');
  } catch (err) {
    return errorResponse(err && err.message ? err.message : err);
  }
}

/** Minimal defensive validation before writing a Results row. */
function validateResultPayload_(payload) {
  if (!safeText(payload.student_name)) throw new Error('student_name is required.');
  if (!safeText(payload.student_id)) throw new Error('student_id is required.');
  if (!safeText(payload.topic_id)) throw new Error('topic_id is required.');
  if (!Array.isArray(payload.wrong_question_summaries)) {
    throw new Error('wrong_question_summaries must be an array.');
  }
}
