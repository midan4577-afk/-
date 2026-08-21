/**
 * ui.js
 * DOM rendering only — no fetch calls, no quiz-scoring logic here.
 * app.js calls these functions in response to state changes.
 */

var UI = (function () {
  var el = {
    loading: document.getElementById('loading'),
    errorBanner: document.getElementById('error-banner'),

    screens: {
      student: document.getElementById('screen-student'),
      topic: document.getElementById('screen-topic'),
      quiz: document.getElementById('screen-quiz'),
      results: document.getElementById('screen-results'),
    },

    studentForm: document.getElementById('student-form'),
    studentName: document.getElementById('student-name'),
    studentId: document.getElementById('student-id'),
    studentNameError: document.getElementById('student-name-error'),
    studentIdError: document.getElementById('student-id-error'),

    topicStudentHint: document.getElementById('topic-student-hint'),
    topicList: document.getElementById('topic-list'),
    topicEmpty: document.getElementById('topic-empty'),

    progressText: document.getElementById('quiz-progress-text'),
    progressFill: document.getElementById('progress-fill'),
    questionText: document.getElementById('question-text'),
    optionsList: document.getElementById('options-list'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    btnFinish: document.getElementById('btn-finish'),

    scorePercentText: document.getElementById('score-percent-text'),
    statCorrect: document.getElementById('stat-correct'),
    statWrong: document.getElementById('stat-wrong'),
    statUnanswered: document.getElementById('stat-unanswered'),
    reviewList: document.getElementById('review-list'),
    reviewSection: document.getElementById('review-section'),
    btnRestart: document.getElementById('btn-restart'),

    modalOverlay: document.getElementById('confirm-modal'),
    confirmCancel: document.getElementById('confirm-cancel'),
    confirmSubmit: document.getElementById('confirm-submit'),
    confirmModalText: document.getElementById('confirm-modal-text'),
  };

  function showScreen(name) {
    Object.keys(el.screens).forEach(function (key) {
      el.screens[key].hidden = key !== name;
    });
  }

  function setLoading(isLoading) {
    el.loading.hidden = !isLoading;
  }

  function showError(message) {
    el.errorBanner.textContent = message;
    el.errorBanner.hidden = false;
  }

  function clearError() {
    el.errorBanner.hidden = true;
    el.errorBanner.textContent = '';
  }

  function setFieldError(fieldErrorEl, message) {
    if (!message) {
      fieldErrorEl.hidden = true;
      fieldErrorEl.textContent = '';
    } else {
      fieldErrorEl.hidden = false;
      fieldErrorEl.textContent = message;
    }
  }

  function renderTopics(topics, onPick) {
    el.topicList.innerHTML = '';
    el.topicEmpty.hidden = topics.length > 0;

    topics.forEach(function (topic) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'topic-card';
      btn.innerHTML =
        escapeHtml(topic.topic_name) +
        '<span class="topic-meta">' + topic.questions_per_quiz + ' שאלות</span>';
      btn.addEventListener('click', function () { onPick(topic); });
      el.topicList.appendChild(btn);
    });
  }

  function renderQuestion(question, index, total, selectedKey, onSelect) {
    el.progressText.textContent = 'שאלה ' + (index + 1) + ' מתוך ' + total;
    el.progressFill.style.width = Math.round(((index + 1) / total) * 100) + '%';
    el.questionText.textContent = question.question_text;

    el.optionsList.innerHTML = '';
    question.options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option-btn' + (opt.key === selectedKey ? ' selected' : '');
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', opt.key === selectedKey ? 'true' : 'false');
      btn.innerHTML = '<span class="bullet"></span><span>' + escapeHtml(opt.text) + '</span>';
      btn.addEventListener('click', function () { onSelect(opt.key); });
      el.optionsList.appendChild(btn);
    });

    el.btnPrev.disabled = index === 0;
    el.btnNext.hidden = index === total - 1;
  }

  function renderResults(scoreResult) {
    el.scorePercentText.textContent = scoreResult.score_percent + '%';
    el.statCorrect.textContent = scoreResult.correct_count;
    el.statWrong.textContent = scoreResult.wrong_count;
    el.statUnanswered.textContent = scoreResult.unanswered_count;

    el.reviewList.innerHTML = '';
    if (scoreResult.review_items.length === 0) {
      el.reviewSection.hidden = true;
    } else {
      el.reviewSection.hidden = false;
      scoreResult.review_items.forEach(function (item) {
        var card = document.createElement('div');
        card.className = 'review-item status-' + item.status;
        var tagText = item.status === 'unanswered' ? 'ללא מענה' : 'תשובה שגויה';
        var selectedText = item.selected_text || 'לא נענתה';

        card.innerHTML =
          '<span class="tag">' + tagText + '</span>' +
          '<div class="review-q">' + escapeHtml(item.question_text) + '</div>' +
          '<div class="review-row">התשובה שלך: <strong>' + escapeHtml(selectedText) + '</strong></div>' +
          '<div class="review-row">התשובה הנכונה: <strong>' + escapeHtml(item.correct_text) + '</strong></div>';

        el.reviewList.appendChild(card);
      });
    }
  }

  function showConfirmModal(unansweredCount) {
    el.confirmModalText.textContent =
      'נותרו ' + unansweredCount + ' שאלות ללא מענה. האם ברצונך לשלוח בכל זאת?';
    el.modalOverlay.hidden = false;
  }

  function hideConfirmModal() {
    el.modalOverlay.hidden = true;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  return {
    el: el,
    showScreen: showScreen,
    setLoading: setLoading,
    showError: showError,
    clearError: clearError,
    setFieldError: setFieldError,
    renderTopics: renderTopics,
    renderQuestion: renderQuestion,
    renderResults: renderResults,
    showConfirmModal: showConfirmModal,
    hideConfirmModal: hideConfirmModal,
  };
})();
