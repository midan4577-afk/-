/**
 * app.js
 * Controller: wires UI events to Api calls and Quiz state.
 * This is the only file that "orchestrates" — it has no rendering
 * details (ui.js) and no scoring math (quiz.js) of its own.
 */

(function () {
  var student = null;
  var currentTopics = [];

  document.getElementById('app-title').textContent = window.APP_CONFIG.APP_TITLE;

  init();

  function init() {
    UI.showScreen('student');
    wireStudentForm();
    wireQuizNav();
    wireConfirmModal();
    wireRestart();
  }

  // ---- Screen 1: student details ----------------------------------------

  function wireStudentForm() {
    UI.el.studentForm.addEventListener('submit', function (e) {
      e.preventDefault();
      UI.clearError();

      var name = UI.el.studentName.value.trim();
      var id = UI.el.studentId.value.trim();
      var valid = true;

      if (!Validation.isNonEmptyName(name)) {
        UI.setFieldError(UI.el.studentNameError, 'נא להזין שם מלא.');
        valid = false;
      } else {
        UI.setFieldError(UI.el.studentNameError, null);
      }

      if (!Validation.isValidIsraeliId(id)) {
        UI.setFieldError(UI.el.studentIdError, 'מספר תעודת הזהות אינו תקין.');
        valid = false;
      } else {
        UI.setFieldError(UI.el.studentIdError, null);
      }

      if (!valid) return;

      student = { name: name, id: id };
      loadTopics();
    });
  }

  // ---- Screen 2: topic picker --------------------------------------------

  async function loadTopics() {
    UI.setLoading(true);
    UI.clearError();
    try {
      currentTopics = await Api.getTopics();
      UI.el.topicStudentHint.textContent = 'שלום ' + student.name + ', בחר/י נושא לתרגול:';
      UI.renderTopics(currentTopics, onTopicPicked);
      UI.showScreen('topic');
    } catch (err) {
      UI.showError(err.message);
    } finally {
      UI.setLoading(false);
    }
  }

  async function onTopicPicked(topic) {
    UI.setLoading(true);
    UI.clearError();
    try {
      var data = await Api.getQuestions(topic.topic_id);
      if (!data.questions || data.questions.length === 0) {
        UI.showError('אין שאלות פעילות בנושא זה כרגע. יש לבחור נושא אחר.');
        return;
      }
      Quiz.start(data.topic, data.questions, student);
      renderCurrentQuestion();
      UI.showScreen('quiz');
    } catch (err) {
      UI.showError(err.message);
    } finally {
      UI.setLoading(false);
    }
  }

  // ---- Screen 3: quiz -----------------------------------------------------

  function renderCurrentQuestion() {
    var state = Quiz.getState();
    UI.renderQuestion(
      Quiz.currentQuestion(),
      state.currentIndex,
      state.questions.length,
      Quiz.selectedAnswerForCurrent(),
      onAnswerSelected
    );
  }

  function onAnswerSelected(optionKey) {
    Quiz.selectAnswer(optionKey);
    renderCurrentQuestion();
  }

  function wireQuizNav() {
    UI.el.btnNext.addEventListener('click', function () {
      Quiz.goNext();
      renderCurrentQuestion();
    });
    UI.el.btnPrev.addEventListener('click', function () {
      Quiz.goPrevious();
      renderCurrentQuestion();
    });
    UI.el.btnFinish.addEventListener('click', function () {
      var unanswered = Quiz.unansweredCount();
      if (unanswered > 0) {
        UI.showConfirmModal(unanswered);
      } else {
        finishQuiz();
      }
    });
  }

  function wireConfirmModal() {
    UI.el.confirmCancel.addEventListener('click', UI.hideConfirmModal);
    UI.el.confirmSubmit.addEventListener('click', function () {
      UI.hideConfirmModal();
      finishQuiz();
    });
  }

  // ---- Screen 4: results ---------------------------------------------------

  async function finishQuiz() {
    var state = Quiz.getState();
    var result = Quiz.score();

    UI.renderResults(result);
    UI.showScreen('results');

    // Save to the sheet in the background; a failed save shouldn't block
    // the student from seeing their own results.
    try {
      await Api.submitResult({
        student_name: state.student.name,
        student_id: state.student.id,
        topic_id: state.topic.topic_id,
        topic_name: state.topic.topic_name,
        total_questions: result.total_questions,
        answered_questions: result.answered_questions,
        correct_count: result.correct_count,
        wrong_count: result.wrong_count,
        unanswered_count: result.unanswered_count,
        score_percent: result.score_percent,
        wrong_question_ids: result.review_items.map(function (i) { return i.question_id; }).join(', '),
        wrong_question_summaries: result.review_items,
      });
    } catch (err) {
      UI.showError('התוצאה מוצגת, אך שמירתה בגיליון נכשלה: ' + err.message);
    }
  }

  function wireRestart() {
    UI.el.btnRestart.addEventListener('click', function () {
      UI.clearError();
      UI.el.studentForm.reset();
      student = null;
      UI.showScreen('student');
    });
  }
})();
