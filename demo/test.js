var writer;
var isCharVisible;
var isOutlineVisible;

/** Set active state on one quiz button and clear all others. Pass null to clear all. */
function setActiveQuizBtn(activeEl) {
  ['.js-quiz', '.js-quiz-random'].forEach(function (sel) {
    var el = document.querySelector(sel);
    if (el) el.classList.remove('active');
  });
  if (activeEl) activeEl.classList.add('active');
}

function printStrokePoints(data) {
  var pointStrs = data.drawnPath.points.map((point) => `{x: ${point.x}, y: ${point.y}}`);
  console.log(`[${pointStrs.join(', ')}]`);
}

function updateCharacter() {
  setActiveQuizBtn(null);
  document.querySelector('#quiz-random-result').textContent = '';
  document.querySelector('#target').innerHTML = '';

  var character = document.querySelector('.js-char').value;
  window.location.hash = character;
  writer = HanziWriter.create('target', character, {
    width: 400,
    height: 400,
    renderer: 'svg',
    radicalColor: '#166E16',
    onCorrectStroke: printStrokePoints,
    onMistake: printStrokePoints,
    showCharacter: false,
  });
  isCharVisible = true;
  isOutlineVisible = true;
  window.writer = writer;
}

window.onload = function () {
  var char = decodeURIComponent(window.location.hash.slice(1));
  if (char) {
    document.querySelector('.js-char').value = char;
  }

  updateCharacter();

  document.querySelector('.js-char-form').addEventListener('submit', function (evt) {
    evt.preventDefault();
    updateCharacter();
  });

  document.querySelector('.js-toggle').addEventListener('click', function () {
    isCharVisible ? writer.hideCharacter() : writer.showCharacter();
    isCharVisible = !isCharVisible;
  });
  document.querySelector('.js-toggle-hint').addEventListener('click', function () {
    isOutlineVisible ? writer.hideOutline() : writer.showOutline();
    isOutlineVisible = !isOutlineVisible;
  });
  document.querySelector('.js-animate').addEventListener('click', function () {
    writer.animateCharacter();
  });
  document.querySelector('.js-quiz').addEventListener('click', function () {
    setActiveQuizBtn(this);
    document.querySelector('#quiz-random-result').textContent = '';
    writer.quiz({
      showOutline: true,
    });
  });

  document.querySelector('.js-quiz-random').addEventListener('click', function () {
    setActiveQuizBtn(this);
    var resultEl = document.querySelector('#quiz-random-result');
    resultEl.textContent = 'Write each stroke in any order...';
    resultEl.style.color = '#888';

    writer.quiz({
      showOutline: true,
      randomOrder: true,
      onComplete: function (summary) {
        setActiveQuizBtn(null);
        var totalStrokes = summary.userStrokeOrder.length;
        var isCorrect = summary.userStrokeOrder.every(function (idx, i) {
          return idx === i;
        });
        if (isCorrect) {
          resultEl.textContent = '🎉 Correct stroke order!';
          resultEl.style.color = '#4caf50';
        } else {
          resultEl.textContent =
            '❌ Wrong order. You wrote: [' +
            summary.userStrokeOrder.join(', ') +
            '], correct: [' +
            Array.from({ length: totalStrokes }, function (_, i) { return i; }).join(', ') +
            ']';
          resultEl.style.color = '#e85d04';
        }
      },
    });
  });
};
