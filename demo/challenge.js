// Challenge mode - 10 levels, each with a random character, 3 retries per level
// User draws freely in any order; stroke order validated after completion

const CHARACTER_POOL = [
  '我', '你', '他', '她', '的', '了', '是', '在', '有', '不',
  '人', '们', '好', '大', '小', '上', '下', '中', '国', '家',
  '天', '地', '日', '月', '水', '火', '山', '石', '金', '木',
  '土', '心', '手', '口', '目', '耳', '足', '走', '来', '去',
  '开', '关', '门', '学', '习', '书', '写', '读', '画', '唱'
];

const TOTAL_LEVELS = 10;
const MAX_ATTEMPTS = 3;

let levelChars = [];
let currentLevel = 0;
let currentAttempt = 0;
let writer = null;
let quizActive = false;

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function initLevels() {
  var shuffled = shuffle(CHARACTER_POOL.slice());
  levelChars = [];
  for (var i = 0; i < TOTAL_LEVELS; i++) {
    levelChars.push(shuffled[i % shuffled.length]);
  }
}

function showStart() {
  document.getElementById('start-screen').style.display = '';
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('end-screen').style.display = 'none';
}

function showGame() {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = '';
  document.getElementById('end-screen').style.display = 'none';
}

function showEnd(message) {
  if (writer) {
    writer.cancelQuiz();
  }
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('end-screen').style.display = '';
  document.getElementById('end-msg').textContent = message;
}

function updateHeader() {
  document.getElementById('level-info').textContent =
    '第 ' + (currentLevel + 1) + ' / ' + TOTAL_LEVELS + ' 关';
  document.getElementById('attempts-info').textContent =
    '剩余尝试: ' + (MAX_ATTEMPTS - currentAttempt);
}

function isCorrectOrder(order) {
  for (var i = 0; i < order.length; i++) {
    if (order[i] !== i) return false;
  }
  return true;
}

function loadLevel(level) {
  updateHeader();
  setFeedback('');

  var char = levelChars[level];
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
      quizActive = false;

      if (isCorrectOrder(summary.userStrokeOrder)) {
        // All strokes drawn in correct order — level passed
        setFeedback('闯关成功！', true);
        document.getElementById('btn-retry').disabled = true;
        setTimeout(function () {
          document.getElementById('btn-retry').disabled = false;
          if (currentLevel + 1 >= TOTAL_LEVELS) {
            showEnd('恭喜通关！你完成了全部 ' + TOTAL_LEVELS + ' 关挑战！');
          } else {
            currentLevel++;
            currentAttempt = 0;
            loadLevel(currentLevel);
          }
        }, 1500);
      } else {
        // Stroke order was wrong — attempt failed
        document.getElementById('btn-retry').disabled = true;
        setFeedback(
          '笔画顺序有误，即将重试（剩余 ' + (MAX_ATTEMPTS - currentAttempt - 1) + ' 次）',
          false
        );
        setTimeout(function () {
          document.getElementById('btn-retry').disabled = false;
          currentAttempt++;
          if (currentAttempt >= MAX_ATTEMPTS) {
            showEnd('挑战结束！你通过了 ' + currentLevel + ' / ' + TOTAL_LEVELS + ' 关。');
          } else {
            writer.cancelQuiz();
            loadLevel(currentLevel);
          }
        }, 2000);
      }
    },
  });
}

function retryLevel() {
  if (!quizActive) return;
  currentAttempt++;
  if (currentAttempt >= MAX_ATTEMPTS) {
    showEnd('挑战结束！你通过了 ' + currentLevel + ' / ' + TOTAL_LEVELS + ' 关。');
    return;
  }
  writer.cancelQuiz();
  loadLevel(currentLevel);
}

function setFeedback(text, isSuccess) {
  var el = document.getElementById('feedback');
  el.textContent = text;
  el.className = 'feedback' + (isSuccess ? ' feedback-success' : '');
}

// --- Event listeners ---

document.getElementById('btn-start').addEventListener('click', function () {
  initLevels();
  currentLevel = 0;
  currentAttempt = 0;
  showGame();
  loadLevel(0);
});

document.getElementById('btn-retry').addEventListener('click', retryLevel);

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
