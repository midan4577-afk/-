/**
 * api.js
 * Thin wrapper around the Apps Script Web App HTTP API.
 * POST is sent as text/plain on purpose: Apps Script Web Apps don't
 * handle CORS preflight (OPTIONS) requests, so we keep every request a
 * CORS "simple request" (GET, or POST with text/plain body).
 */

var Api = (function () {
  function checkUrlConfigured() {
    var url = window.APP_CONFIG.API_URL;
    if (!url || url.indexOf('PASTE_YOUR_APPS_SCRIPT') !== -1) {
      throw new Error('האפליקציה עדיין לא חוברה לגיליון (API_URL לא הוגדר ב-config.js).');
    }
    return url;
  }

  async function request(response) {
    var text = await response.text();
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('שרת החזיר תשובה לא תקינה. נסו שוב מאוחר יותר.');
    }
    if (!data.ok) {
      throw new Error(data.error || 'אירעה שגיאה בשרת.');
    }
    return data;
  }

  async function getTopics() {
    var url = checkUrlConfigured();
    var res = await fetch(url + '?action=topics');
    var data = await request(res);
    return data.topics;
  }

  async function getQuestions(topicId) {
    var url = checkUrlConfigured();
    var res = await fetch(url + '?action=questions&topic_id=' + encodeURIComponent(topicId));
    var data = await request(res);
    return { topic: data.topic, questions: data.questions };
  }

  async function submitResult(payload) {
    var url = checkUrlConfigured();
    var res = await fetch(url, {
      method: 'POST',
      // text/plain avoids a CORS preflight; the body itself is JSON text.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'submitResult', payload: payload }),
    });
    var data = await request(res);
    return data.submission_id;
  }

  return { getTopics: getTopics, getQuestions: getQuestions, submitResult: submitResult };
})();
