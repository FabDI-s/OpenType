import { saveSession, saveKeystrokes } from './db.js';

const DATA_FILES = {
  de: './data/de.json',
  en: './data/en.json',
  code: './data/code.json',
  zitate: './data/literatur/zitate.json',
  klappentexte: './data/literatur/klappentexte.json',
};

const texts = {};

async function loadTexts(mode) {
  if (texts[mode]) return;
  const res = await fetch(DATA_FILES[mode]);
  texts[mode] = await res.json();
}

let mode = 'de';
let currentEntry = null;
let chars = [];
let cursor = 0;
let errors = 0;
let totalKeystrokes = 0;
let startTime = null;
let timerInterval = null;
let finished = false;
let focused = false;
let keystrokeLog = [];

const display = document.getElementById('text-display');
const charsEl = document.getElementById('text-chars');
const hiddenInput = document.getElementById('hidden-input');
const progressBar = document.getElementById('progress-bar');
const wpmDisplay = document.getElementById('wpm-display');
const accDisplay = document.getElementById('acc-display');
const timeDisplay = document.getElementById('time-display');
const typingView = document.getElementById('typing-view');
const resultView = document.getElementById('result');
const attrEl = document.getElementById('attribution');

function pickEntry() {
  const pool = texts[mode];
  if (!pool || pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  let entry;
  do { entry = pool[Math.floor(Math.random() * pool.length)]; }
  while (entry === currentEntry);
  return entry;
}

function renderText(text) {
  charsEl.innerHTML = '';
  chars = text.split('');
  chars.forEach((ch, i) => {
    const span = document.createElement('span');
    span.className = 'char' + (i === 0 ? ' current' : '');
    span.textContent = ch;
    charsEl.appendChild(span);
  });
}

function showAttribution(entry) {
  document.getElementById('attr-title').textContent = entry.title;
  document.getElementById('attr-author').textContent = entry.author;
  document.getElementById('attr-year').textContent = entry.year ? '(' + entry.year + ')' : '';
  document.getElementById('attr-more').onclick = () => {
    const q = encodeURIComponent(entry.search || (entry.title + ' ' + entry.author));
    window.open('https://www.google.com/search?q=' + q, '_blank');
  };
  attrEl.style.display = 'flex';
  requestAnimationFrame(() => attrEl.classList.add('show'));
}

async function reset() {
  clearInterval(timerInterval);
  cursor = 0; errors = 0; totalKeystrokes = 0;
  startTime = null; finished = false; keystrokeLog = [];

  await loadTexts(mode);
  currentEntry = pickEntry();
  if (!currentEntry) return;

  renderText(currentEntry.text);
  charsEl.classList.toggle('lit-font', mode === 'zitate' || mode === 'klappentexte');

  attrEl.classList.remove('show');
  attrEl.style.display = 'none';
  if (currentEntry.title) showAttribution(currentEntry);

  progressBar.style.width = '0%';
  wpmDisplay.textContent = '–';
  accDisplay.textContent = '–';
  timeDisplay.textContent = '–';

  typingView.style.display = '';
  resultView.classList.remove('visible');
  hiddenInput.value = '';
  if (focused) focusInput();
}

function focusInput() {
  hiddenInput.focus();
  display.classList.add('focused');
  focused = true;
}

function getSpans() { return charsEl.querySelectorAll('.char'); }

function updateCursor() {
  const spans = getSpans();
  spans.forEach(s => s.classList.remove('current'));
  if (cursor < spans.length) spans[cursor].classList.add('current');
}

function calcWpm() {
  if (!startTime) return 0;
  const elapsed = (Date.now() - startTime) / 60000;
  return Math.max(0, Math.round((cursor / 5) / elapsed));
}

function calcAcc() {
  if (totalKeystrokes === 0) return 100;
  return Math.round(((totalKeystrokes - errors) / totalKeystrokes) * 100);
}

function startTimer() {
  timerInterval = setInterval(() => {
    if (!startTime || finished) return;
    timeDisplay.textContent = ((Date.now() - startTime) / 1000).toFixed(1);
    wpmDisplay.textContent = calcWpm();
    accDisplay.textContent = calcAcc() + '%';
  }, 100);
}

async function finish() {
  finished = true;
  clearInterval(timerInterval);
  display.classList.remove('focused');

  const elapsed = (Date.now() - startTime) / 1000;
  const wpm = Math.round((chars.length / 5) / (elapsed / 60));
  const acc = calcAcc();

  const kpm = Math.round(totalKeystrokes / (elapsed / 60));

  document.getElementById('r-wpm').textContent = wpm;
  document.getElementById('r-acc').textContent = acc + '%';
  document.getElementById('r-time').textContent = elapsed.toFixed(1) + 's';
  document.getElementById('r-kpm').textContent = kpm;
  document.getElementById('r-err').textContent = errors;

  const srcBlock = document.getElementById('result-source');
  if (currentEntry.title) {
    document.getElementById('rs-title').textContent = currentEntry.title;
    document.getElementById('rs-author').textContent = currentEntry.author + (currentEntry.year ? ' · ' + currentEntry.year : '');
    document.getElementById('rs-search').onclick = () => {
      window.open('https://www.google.com/search?q=' + encodeURIComponent(currentEntry.search || currentEntry.title + ' ' + currentEntry.author), '_blank');
    };
    srcBlock.classList.add('visible');
  } else {
    srcBlock.classList.remove('visible');
  }

  typingView.style.display = 'none';
  resultView.classList.add('visible');

  try {
    const sessionId = await saveSession({
      mode,
      textId: currentEntry.id,
      wpm,
      accuracy: acc,
      durationMs: Math.round(elapsed * 1000),
      totalKeystrokes,
      errors,
    });
    await saveKeystrokes(sessionId, keystrokeLog);
  } catch (err) {
    console.warn('DB save failed:', err);
  }
}

function revertSpan(span, index) {
  span.classList.remove('correct', 'wrong');
  span.textContent = chars[index];
}

hiddenInput.addEventListener('keydown', (e) => {
  if (finished) return;
  if (e.key === 'Tab') { e.preventDefault(); reset(); return; }

  if (e.key === 'Backspace') {
    e.preventDefault();
    const spans = getSpans();

    // Ctrl+Backspace (Win/Linux) or Alt+Backspace (Mac) → delete whole word
    if (e.ctrlKey || e.altKey) {
      // step back over spaces, then over the word
      while (cursor > 0 && chars[cursor - 1] === ' ') {
        cursor--;
        revertSpan(spans[cursor], cursor);
      }
      while (cursor > 0 && chars[cursor - 1] !== ' ') {
        cursor--;
        revertSpan(spans[cursor], cursor);
      }
    } else if (cursor > 0) {
      cursor--;
      revertSpan(spans[cursor], cursor);
    }

    updateCursor();
    progressBar.style.width = (cursor / chars.length * 100) + '%';
    return;
  }

  if (e.key.length !== 1) return;

  const now = Date.now();
  if (!startTime) { startTime = now; startTimer(); }

  totalKeystrokes++;
  const spans = getSpans();
  const expected = chars[cursor];
  const correct = e.key === expected;

  keystrokeLog.push({
    position: cursor,
    expected,
    actual: e.key,
    correct,
    timestampMs: now - startTime,
  });

  if (correct) {
    spans[cursor].classList.add('correct');
    spans[cursor].textContent = expected;
  } else {
    spans[cursor].classList.add('wrong');
    spans[cursor].textContent = e.key;
    errors++;
  }

  cursor++;
  progressBar.style.width = (cursor / chars.length * 100) + '%';
  if (cursor >= chars.length) { finish(); return; }
  updateCursor();
  hiddenInput.value = '';
});

display.addEventListener('click', () => focusInput());
hiddenInput.addEventListener('blur', () => { if (!finished) display.classList.remove('focused'); });
hiddenInput.addEventListener('focus', () => { display.classList.add('focused'); focused = true; });

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mode = btn.dataset.mode;
    reset();
  });
});

document.getElementById('new-btn').addEventListener('click', () => reset());
document.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); reset(); } });
document.getElementById('restart-btn').addEventListener('click', () => { reset(); focusInput(); });

document.getElementById('theme-btn').addEventListener('click', () => {
  document.documentElement.classList.toggle('light');
});

// ── Practice-Modus ───────────────────────────────────────────

window.addEventListener('practice', (e) => {
  const { practiceText } = e.detail;
  currentEntry = { id: 'practice', text: practiceText };
  texts['practice'] = [currentEntry];
  mode = 'practice';
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));

  clearInterval(timerInterval);
  cursor = 0; errors = 0; totalKeystrokes = 0;
  startTime = null; finished = false; keystrokeLog = [];

  renderText(practiceText);
  charsEl.classList.remove('lit-font');
  attrEl.classList.remove('show');
  attrEl.style.display = 'none';
  progressBar.style.width = '0%';
  wpmDisplay.textContent = '–';
  accDisplay.textContent = '–';
  timeDisplay.textContent = '–';
  typingView.style.display = '';
  resultView.classList.remove('visible');
  hiddenInput.value = '';
  focusInput();
});

reset();
