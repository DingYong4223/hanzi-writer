// Challenge mode - 10 levels, progressive difficulty, progress saved to localStorage
// Strokes must be in correct order; user draws freely, validated after completion

var LEVELS = [
  { char: '人', strokes: 2, label: '入门' },
  { char: '大', strokes: 3, label: '基础' },
  { char: '口', strokes: 3, label: '方正' },
  { char: '日', strokes: 4, label: '日月' },
  { char: '水', strokes: 4, label: '流水' },
  { char: '手', strokes: 4, label: '动手' },
  { char: '金', strokes: 8, label: '金石' },
  { char: '国', strokes: 8, label: '家园' },
  { char: '起', strokes: 10, label: '起步' },
  { char: '鼻', strokes: 14, label: '终章' },
];

var TOTAL_LEVELS = LEVELS.length;
var MAX_ATTEMPTS = 3;
var STORAGE_KEY = 'hanzi-writer-challenge';

var currentLevel = 0;
var currentAttempt = 0;
var writer = null;
var quizActive = false;

// ---- Persistence ----

function loadProgress() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { completed: [] };
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function clearProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

function isLevelUnlocked(level, progress) {
  if (level === 0) return true;
  return progress.completed.indexOf(level - 1) !== -1;
}

// ---- Screen management ----

function showScreen(name) {
  var screens = ['level-screen', 'game-screen', 'end-screen'];
  for (var i = 0; i < screens.length; i++) {
    document.getElementById(screens[i]).style.display =
      screens[i] === name ? '' : 'none';
  }
}

// ---- Level grid rendering ----

function renderLevelGrid() {
  var progress = loadProgress();
  var completed = progress.completed;
  var container = document.getElementById('level-grid');
  container.innerHTML = '';

  // Progress bar
  document.getElementById('progress-text').textContent =
    completed.length + ' / ' + TOTAL_LEVELS;
  document.getElementById('progress-bar-fill').style.width =
    (completed.length / TOTAL_LEVELS * 100) + '%';

  for (var i = 0; i < TOTAL_LEVELS; i++) {
    var lv = LEVELS[i];
    var isCompleted = completed.indexOf(i) !== -1;
    var isUnlocked = isLevelUnlocked(i, progress);
    var isCurrent = isUnlocked && !isCompleted;

    var card = document.createElement('div');
    card.className = 'level-card';
    if (isCompleted) card.classList.add('level-completed');
    else if (isUnlocked) card.classList.add('level-unlocked');
    else card.classList.add('level-locked');

    var numBadge = document.createElement('div');
    numBadge.className = 'level-num';
    numBadge.textContent = 'Lv ' + (i + 1);

    var charEl = document.createElement('div');
    charEl.className = 'level-char';
    charEl.textContent = isUnlocked ? lv.char : '?';

    var infoEl = document.createElement('div');
    infoEl.className = 'level-info';
    infoEl.textContent = isUnlocked
      ? (lv.label + ' · ' + lv.strokes + '画')
      : '???';

    var statusEl = document.createElement('div');
    statusEl.className = 'level-status';
    if (isCompleted) {
      statusEl.textContent = '✓';
      statusEl.classList.add('status-done');
    } else if (isUnlocked) {
      statusEl.textContent = '▶';
      statusEl.classList.add('status-go');
    } else {
      statusEl.textContent = '🔒';
    }

    card.appendChild(numBadge);
    card.appendChild(charEl);
    card.appendChild(infoEl);
    card.appendChild(statusEl);

    if (isUnlocked) {
      card.addEventListener('click', (function (idx) {
        return function () { startLevel(idx); };
      })(i));
    }

    container.appendChild(card);
  }
}

// ---- Game flow ----

function startLevel(level) {
  currentLevel = level;
  currentAttempt = 0;
  showScreen('game-screen');
  loadLevel(level);
}

function isCorrectOrder(order) {
  for (var i = 0; i < order.length; i++) {
    if (order[i] !== i) return false;
  }
  return true;
}

function loadLevel(level) {
  document.getElementById('level-info').textContent =
    '第 ' + (level + 1) + ' 关 · ' + LEVELS[level].label;
  document.getElementById('attempts-info').textContent =
    '剩余尝试: ' + (MAX_ATTEMPTS - currentAttempt);
  setFeedback('');

  var lv = LEVELS[level];
  document.querySelector('#target').innerHTML = '';

  writer = HanziWriter.create('target', lv.char, {
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
    randomOrder: true,
    onComplete: function (summary) {
      quizActive = false;

      if (isCorrectOrder(summary.userStrokeOrder)) {
        // Level passed
        var progress = loadProgress();
        if (progress.completed.indexOf(level) === -1) {
          progress.completed.push(level);
          saveProgress(progress);
        }
        setFeedback('闯关成功！', true);
        document.getElementById('btn-retry').disabled = true;

        setTimeout(function () {
          document.getElementById('btn-retry').disabled = false;
          if (level + 1 >= TOTAL_LEVELS) {
            showScreen('level-screen');
            renderLevelGrid();
            showVictoryIfComplete();
          } else {
            showScreen('level-screen');
            renderLevelGrid();
          }
        }, 1500);
      } else {
        // Stroke order wrong — attempt failed
        document.getElementById('btn-retry').disabled = true;
        setFeedback(
          '笔画顺序有误（剩余 ' + (MAX_ATTEMPTS - currentAttempt - 1) + ' 次）',
          false
        );
        setTimeout(function () {
          document.getElementById('btn-retry').disabled = false;
          currentAttempt++;
          if (currentAttempt >= MAX_ATTEMPTS) {
            showScreen('level-screen');
            renderLevelGrid();
          } else {
            writer.cancelQuiz();
            loadLevel(level);
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
    showScreen('level-screen');
    renderLevelGrid();
    return;
  }
  writer.cancelQuiz();
  loadLevel(currentLevel);
}

function showVictoryIfComplete() {
  var progress = loadProgress();
  if (progress.completed.length >= TOTAL_LEVELS) {
    var msg = document.getElementById('end-msg');
    msg.textContent = '🏆 恭喜通关！你完成了全部 ' + TOTAL_LEVELS + ' 关挑战！';
    document.getElementById('end-screen').style.display = '';
  }
}

function setFeedback(text, isSuccess) {
  var el = document.getElementById('feedback');
  el.textContent = text;
  el.className = 'feedback' + (isSuccess ? ' feedback-success' : '');
}

// ---- Event listeners ----

document.getElementById('btn-retry').addEventListener('click', retryLevel);

document.getElementById('btn-back-levels').addEventListener('click', function () {
  if (writer) writer.cancelQuiz();
  showScreen('level-screen');
  renderLevelGrid();
});

document.getElementById('btn-restart').addEventListener('click', function () {
  showScreen('level-screen');
  renderLevelGrid();
  document.getElementById('end-screen').style.display = 'none';
});

document.getElementById('btn-reset-progress').addEventListener('click', function () {
  if (confirm('确定要重置所有关卡进度吗？')) {
    clearProgress();
    renderLevelGrid();
    document.getElementById('end-screen').style.display = 'none';
  }
});

// ---- Init ----

renderLevelGrid();
