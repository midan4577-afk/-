/**
 * quiz.js
 * Pure quiz state + logic: shuffling, navigation, scoring.
 * No DOM access here — ui.js owns rendering, app.js wires them together.
 */

function shuffle(arrayIn) {
  var arr = arrayIn.slice();
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

var Quiz = (function () {
  var state = null;

  /**
   * Builds a fresh quiz attempt from the raw questions fetched from the
   * backend: shuffles question order, slices to questions_per_quiz, and
   * shuffles each question's answer order independently.
   */
  function start(topic, rawQuestions, student) {
    var picked = shuffle(rawQuestions).slice(0, topic.questions_per_quiz);
    var questions = picked.map(function (q) {
      return {
        question_id: q.question_id,
        question_text: q.question_text,
        correct_key: q.correct_key,
        options: shuffle(q.options), // each option keeps its original `key`
      };
    });

    state = {
      student: student,
      topic: topic,
      questions: questions,
      answers: {}, // question_id -> selected option key
      currentIndex: 0,
    };
    return state;
  }

  function getState() {
    return state;
  }

  function currentQuestion() {
    return state.questions[state.currentIndex];
  }

  function selectAnswer(optionKey) {
    var q = currentQuestion();
    state.answers[q.question_id] = optionKey;
  }

  function selectedAnswerForCurrent() {
    var q = currentQuestion();
    return state.answers[q.question_id] || null;
  }

  function goNext() {
    if (state.currentIndex < state.questions.length - 1) state.currentIndex++;
  }

  function goPrevious() {
    if (state.currentIndex > 0) state.currentIndex--;
  }

  function isLastQuestion() {
    return state.currentIndex === state.questions.length - 1;
  }

  function unansweredCount() {
    return state.questions.filter(function (q) { return !state.answers[q.question_id]; }).length;
  }

  /**
   * Scores the attempt. Unanswered counts as incorrect for the score,
   * but is tracked separately, and both wrong + unanswered items are
   * returned together for the review list (marked by `status`).
   */
  function score() {
    var total = state.questions.length;
    var correct = 0, wrong = 0, unanswered = 0;
    var reviewItems = [];

    state.questions.forEach(function (q) {
      var selectedKey = state.answers[q.question_id] || null;
      var selectedOption = selectedKey
        ? q.options.filter(function (o) { return o.key === selectedKey; })[0]
        : null;
      var correctOption = q.options.filter(function (o) { return o.key === q.correct_key; })[0];

      if (!selectedKey) {
        unanswered++;
        reviewItems.push({
          question_id: q.question_id,
          question_text: q.question_text,
          selected_text: null,
          correct_text: correctOption ? correctOption.text : '',
          status: 'unanswered',
        });
      } else if (selectedKey === q.correct_key) {
        correct++;
      } else {
        wrong++;
        reviewItems.push({
          question_id: q.question_id,
          question_text: q.question_text,
          selected_text: selectedOption ? selectedOption.text : '',
          correct_text: correctOption ? correctOption.text : '',
          status: 'wrong',
        });
      }
    });

    var answered = total - unanswered;
    var scorePercent = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;

    return {
      total_questions: total,
      answered_questions: answered,
      correct_count: correct,
      wrong_count: wrong,
      unanswered_count: unanswered,
      score_percent: scorePercent,
      review_items: reviewItems,
    };
  }

  return {
    start: start,
    getState: getState,
    currentQuestion: currentQuestion,
    selectAnswer: selectAnswer,
    selectedAnswerForCurrent: selectedAnswerForCurrent,
    goNext: goNext,
    goPrevious: goPrevious,
    isLastQuestion: isLastQuestion,
    unansweredCount: unansweredCount,
    score: score,
  };
})();
