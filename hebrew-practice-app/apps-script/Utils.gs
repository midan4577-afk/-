/**
 * Utils.gs
 * Small, dependency-free helpers used by SheetService.gs and Code.gs.
 */

/** Wraps any object as a JSON HTTP response. */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message) {
  return jsonResponse({ ok: false, error: String(message) });
}

/** Trims a value to a string, capped at MAX_TEXT_LEN, never throws. */
function safeText(value) {
  if (value === null || value === undefined) return '';
  var s = String(value).trim();
  return s.length > MAX_TEXT_LEN ? s.substring(0, MAX_TEXT_LEN) : s;
}

/** true/false/1/0/"yes"/"true" style cell -> boolean. Blank = false. */
function toBool(value) {
  if (typeof value === 'boolean') return value;
  var s = String(value).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'active';
}

function toPositiveInt(value, fallback) {
  var n = parseInt(value, 10);
  if (isNaN(n) || n <= 0) return fallback;
  return n;
}

/**
 * Reads a sheet's row-1 headers and returns an array of plain objects
 * keyed by header name. Column order in the sheet doesn't matter as
 * long as the header text matches; this keeps the sheet robust against
 * a teacher inserting/reordering columns.
 */
function sheetToObjects(sheet, requiredHeaders) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 1) return [];

  var headerRow = values[0].map(function (h) { return safeText(h); });
  var headerIndex = {};
  headerRow.forEach(function (h, i) { headerIndex[h] = i; });

  requiredHeaders.forEach(function (h) {
    if (!(h in headerIndex)) {
      throw new Error(
        'Sheet "' + sheet.getName() + '" is missing required column "' + h + '". ' +
        'Check row 1 header spelling.'
      );
    }
  });

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var isEmpty = row.every(function (c) { return c === '' || c === null; });
    if (isEmpty) continue;

    var obj = {};
    requiredHeaders.forEach(function (h) {
      obj[h] = row[headerIndex[h]];
    });
    rows.push(obj);
  }
  return rows;
}

/**
 * Normalizes the Questions.correct_answer cell into one of 'a'|'b'|'c'|'d'.
 * Accepts: a/b/c/d (any case), or the exact text of one of the options
 * (case-insensitive, trimmed) so a teacher can type either the letter
 * or paste the correct option's full text.
 * Returns null if it can't be resolved (question is skipped defensively).
 */
function normalizeCorrectKey(correctAnswerRaw, optionsByKey) {
  var raw = safeText(correctAnswerRaw).toLowerCase();
  if (raw === 'a' || raw === 'b' || raw === 'c' || raw === 'd') return raw;

  var keys = Object.keys(optionsByKey);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var optText = safeText(optionsByKey[key]).toLowerCase();
    if (optText !== '' && optText === raw) return key;
  }
  return null;
}

function generateSubmissionId() {
  return 'sub_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1e6);
}
