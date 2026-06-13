// Test mode - 10 characters, score out of 10, continuous flow
// User draws freely in any order; stroke order validated after completion

const CHARACTER_POOL = [
  '我', '你', '他', '她', '的', '了', '是', '在', '有', '不',
  '人', '们', '好', '大', '小', '上', '下', '中', '国', '家',
  '天', '地', '日', '月', '水', '火', '山', '石', '金', '木',
  '土', '心', '手', '口', '目', '耳', '足', '走', '来', '去',
  '开', '关', '门', '学', '习', '书', '写', '读', '画', '唱'
];

const TOTAL_CHARS = 10;

let testChars = [];
let currentIndex = 0;
let score = 0;
let writer = null;
let quizActive = false;
let charCompleted = false;

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function initTestChars() {
  var shuffled = shuffle(CHARACTER_POOL.slice());
  testChars = [];
  for (var i = 0; i < TOTAL_CHARS; i++) {
    testChars.push(shuffled[i % shuffled.length]);
  }
}

function showStart() {
  document.getElementById('start-screen').style.display = '';
  document.getElementById('test-screen').style.display = 'none';
  document.getElementById('result-screen').style.display = 'none';
}

function showTest() {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('test-screen').style.display = '';
  document.getElementById('result-screen').style.display = 'none';
}

function showResult(message) {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('test-screen').style.display = 'none';
  document.getElementById('result-screen').style.display = '';
  document.getElementById('result-msg').textContent = message;
}

function updateHeader() {
  document.getElementById('char-info').textContent =
    '第 ' + (currentIndex + 1) + ' / ' + TOTAL_CHARS + ' 个字';
  document.getElementById('score-info').textContent =
    '得分: ' + score;
}

function setFeedback(text, isSuccess) {
  var el = document.getElementById('feedback');
  el.textContent = text;
  el.className = 'feedback' + (isSuccess ? ' feedback-success' : '');
}

function isCorrectOrder(order) {
  for (var i = 0; i < order.length; i++) {
    if (order[i] !== i) return false;
  }
  return true;
}

function loadChar(index) {
  if (index >= TOTAL_CHARS) {
    showResult('测试完成！得分: ' + score + ' / ' + TOTAL_CHARS + ' 分');
    return;
  }

  updateHeader();
  setFeedback('');
  charCompleted = false;

  var char = testChars[index];
  document.querySelector('#target').innerHTML = '';

  writer = HanziWriter.create('target', char, {
    width: 300,
    height: 300,
    showOutline: true,
    showCharacter: false,
    strokeColor: '#555',
    outlineColor: '#DDD',
    drawingColor: '#333',
  });

  quizActive = true;
  writer.quiz({
    randomOrder: true,          // draw any stroke in any order
    onComplete: function (summary) {
      if (charCompleted) return;
      charCompleted = true;
      quizActive = false;

      if (isCorrectOrder(summary.userStrokeOrder)) {
        score++;
        setFeedback('✓ 笔画顺序正确！', true);
      } else {
        setFeedback('笔画顺序有误，不得分', false);
      }
      updateHeader();

      setTimeout(function () {
        currentIndex++;
        loadChar(currentIndex);
      }, 1200);
    },
  });
}

function skipChar() {
  if (!quizActive) return;
  quizActive = false;
  writer.cancelQuiz();
  currentIndex++;
  loadChar(currentIndex);
}

// --- Event listeners ---

document.getElementById('btn-start').addEventListener('click', function () {
  initTestChars();
  currentIndex = 0;
  score = 0;
  showTest();
  loadChar(0);
});

document.getElementById('btn-skip').addEventListener('click', skipChar);

document.getElementById('btn-restart').addEventListener('click', function () {
  showStart();
});

document.getElementById('btn-back-home').addEventListener('click', function () {
  if (writer) writer.cancelQuiz();
  window.location.href = 'index.html';
});

document.getElementById('btn-home').addEventListener('click', function () {
  window.location.href = 'index.html';
});
