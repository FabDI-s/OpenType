import { getSessions, getAllKeystrokes } from './db.js';

// ── Navigation ──────────────────────────────────────────────

const typingView = document.getElementById('typing-view');
const analyticsView = document.getElementById('analytics-view');

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    typingView.style.display = view === 'typing' ? '' : 'none';
    if (view === 'analytics') {
      analyticsView.classList.add('visible');
      renderAnalytics();
    } else {
      analyticsView.classList.remove('visible');
    }
  });
});

// ── Auswertungsfunktionen ────────────────────────────────────

function getWpmHistory(sessions) {
  return sessions.slice(0, 50).reverse().map((s, i) => ({ x: i, wpm: s.wpm, mode: s.mode }));
}

function getCharErrorRate(keystrokes) {
  const map = {};
  for (const k of keystrokes) {
    const ch = k.expected.toLowerCase();
    if (!map[ch]) map[ch] = { errors: 0, total: 0 };
    map[ch].total++;
    if (!k.correct) map[ch].errors++;
  }
  const rates = {};
  for (const [ch, d] of Object.entries(map)) {
    rates[ch] = d.total >= 3 ? d.errors / d.total : 0;
  }
  return rates;
}

function getWeakWords(keystrokes) {
  const wordMap = {};
  let wordBuf = '';
  let wordErrors = 0;
  let wordTotal = 0;

  for (const k of keystrokes) {
    if (k.expected === ' ' || k.expected === '\n') {
      if (wordBuf.length >= 2) {
        if (!wordMap[wordBuf]) wordMap[wordBuf] = { errors: 0, total: 0 };
        wordMap[wordBuf].errors += wordErrors;
        wordMap[wordBuf].total += wordTotal;
      }
      wordBuf = ''; wordErrors = 0; wordTotal = 0;
    } else {
      wordBuf += k.expected;
      wordTotal++;
      if (!k.correct) wordErrors++;
    }
  }

  return Object.entries(wordMap)
    .filter(([, d]) => d.total >= 3)
    .map(([word, d]) => ({ word, errors: d.errors, rate: d.errors / d.total }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 15);
}

function getWeakBigrams(keystrokes) {
  const map = {};
  for (let i = 0; i < keystrokes.length - 1; i++) {
    const a = keystrokes[i], b = keystrokes[i + 1];
    if (a.expected === ' ' || b.expected === ' ') continue;
    const bi = a.expected + b.expected;
    if (!map[bi]) map[bi] = { errors: 0, total: 0 };
    map[bi].total++;
    if (!b.correct) map[bi].errors++;
  }
  return Object.entries(map)
    .filter(([, d]) => d.total >= 5)
    .map(([bi, d]) => ({ bi, errors: d.errors, rate: d.errors / d.total }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10);
}

// ── Render ───────────────────────────────────────────────────

async function renderAnalytics() {
  const [sessions, keystrokes] = await Promise.all([getSessions(50), getAllKeystrokes()]);

  renderWpmChart(getWpmHistory(sessions));
  renderHeatmap(getCharErrorRate(keystrokes));
  renderWeakWords(getWeakWords(keystrokes));
  renderBigrams(getWeakBigrams(keystrokes));
}

function renderWpmChart(data) {
  const svg = document.getElementById('wpm-chart');
  const empty = document.getElementById('wpm-empty');
  svg.innerHTML = '';

  if (data.length < 2) {
    svg.style.display = 'none';
    empty.style.display = '';
    return;
  }

  svg.style.display = '';
  empty.style.display = 'none';

  const W = svg.clientWidth || 700;
  const H = 120;
  const pad = { top: 10, right: 16, bottom: 24, left: 36 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  const wpms = data.map(d => d.wpm);
  const minW = Math.min(...wpms);
  const maxW = Math.max(...wpms);
  const range = maxW - minW || 1;

  const xs = data.map((_, i) => pad.left + (i / (data.length - 1)) * iW);
  const ys = data.map(d => pad.top + iH - ((d.wpm - minW) / range) * iH);

  // Area fill
  const areaPoints = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const areaPath = `M${pad.left},${pad.top + iH} L${areaPoints.split(' ').map(p => p).join(' L')} L${pad.left + iW},${pad.top + iH} Z`;
  const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  area.setAttribute('d', areaPath);
  area.setAttribute('fill', 'rgba(212,148,58,0.08)');
  svg.appendChild(area);

  // Line
  const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', linePath);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#d4943a');
  line.setAttribute('stroke-width', '1.5');
  svg.appendChild(line);

  // Dots
  xs.forEach((x, i) => {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', ys[i]);
    dot.setAttribute('r', '3');
    dot.setAttribute('fill', '#d4943a');
    svg.appendChild(dot);
  });

  // Y-axis labels
  [minW, Math.round((minW + maxW) / 2), maxW].forEach(val => {
    const y = pad.top + iH - ((val - minW) / range) * iH;
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', pad.left - 6);
    t.setAttribute('y', y + 4);
    t.setAttribute('text-anchor', 'end');
    t.setAttribute('font-size', '10');
    t.setAttribute('fill', 'rgba(255,255,255,0.25)');
    t.setAttribute('font-family', 'JetBrains Mono, monospace');
    t.textContent = val;
    svg.appendChild(t);
  });

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
}

const QWERTZ = [
  ['q','w','e','r','t','z','u','i','o','p','ü'],
  ['a','s','d','f','g','h','j','k','l','ö','ä'],
  ['y','x','c','v','b','n','m'],
];

function renderHeatmap(rates) {
  const container = document.getElementById('heatmap');
  container.innerHTML = '';

  const maxRate = Math.max(...Object.values(rates), 0.01);

  QWERTZ.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'heatmap-row';
    row.forEach(key => {
      const el = document.createElement('div');
      el.className = 'hkey';
      el.textContent = key;
      const rate = rates[key] || 0;
      const heat = rate === 0 ? 0
        : rate < maxRate * 0.25 ? 1
        : rate < maxRate * 0.5  ? 2
        : rate < maxRate * 0.75 ? 3 : 4;
      el.dataset.heat = heat;
      if (rate > 0) el.title = `${key}: ${Math.round(rate * 100)}% Fehler`;
      rowEl.appendChild(el);
    });
    container.appendChild(rowEl);
  });
}

function renderWeakWords(words) {
  const tbody = document.getElementById('weak-words-body');
  const empty = document.getElementById('words-empty');
  tbody.innerHTML = '';

  if (words.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  words.forEach(({ word, errors, rate }) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${word}</td>
      <td>${errors}</td>
      <td>${Math.round(rate * 100)}%</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderBigrams(bigrams) {
  const tbody = document.getElementById('bigram-body');
  const empty = document.getElementById('bigram-empty');
  tbody.innerHTML = '';

  if (bigrams.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  bigrams.forEach(({ bi, errors, rate }) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${bi}</td>
      <td>${errors}</td>
      <td>${Math.round(rate * 100)}%</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Practice-Button ──────────────────────────────────────────

const DATA_FILES = {
  de: './data/de.json',
  en: './data/en.json',
  code: './data/code.json',
  zitate: './data/literatur/zitate.json',
  klappentexte: './data/literatur/klappentexte.json',
};

async function loadAllTexts() {
  const all = [];
  for (const url of Object.values(DATA_FILES)) {
    try {
      const res = await fetch(url);
      const entries = await res.json();
      entries.forEach(e => all.push(e.text));
    } catch {}
  }
  return all;
}

function buildContextualPracticeText(weakWords, allTexts, targetLength = 280) {
  const weakSet = new Map(weakWords.map(({ word, rate }) => [word.toLowerCase(), rate]));

  // Split all texts into sentences and score each by contained weak words
  const scored = [];
  for (const text of allTexts) {
    const sentences = text.split(/(?<=[.!?—])\s+/);
    for (const sentence of sentences) {
      if (sentence.length < 10) continue;
      const words = sentence.split(/\s+/);
      let score = 0;
      for (const w of words) {
        const clean = w.replace(/[^a-zA-ZäöüÄÖÜßéàè]/g, '').toLowerCase();
        if (weakSet.has(clean)) score += weakSet.get(clean);
      }
      if (score > 0) scored.push({ sentence, score });
    }
  }

  if (scored.length === 0) return null;

  // Sort by score descending, add some randomness among equally-scored sentences
  scored.sort((a, b) => b.score - a.score + (Math.random() - 0.5) * 0.1);

  // Pick sentences until we reach target length, avoid exact duplicates
  const seen = new Set();
  let result = '';
  for (const { sentence } of scored) {
    if (seen.has(sentence)) continue;
    seen.add(sentence);
    result += (result ? ' ' : '') + sentence;
    if (result.length >= targetLength) break;
  }

  // Trim cleanly at sentence boundary if possible
  if (result.length > targetLength) {
    const cut = result.slice(0, targetLength);
    const lastPunct = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    return lastPunct > targetLength * 0.5 ? result.slice(0, lastPunct + 1) : cut.trimEnd();
  }
  return result;
}

document.getElementById('practice-btn').addEventListener('click', async () => {
  const keystrokes = await getAllKeystrokes();
  const weakWords = getWeakWords(keystrokes);

  if (weakWords.length === 0) {
    alert('Noch nicht genug Daten für gezieltes Üben.');
    return;
  }

  const allTexts = await loadAllTexts();
  const practiceText = buildContextualPracticeText(weakWords, allTexts);

  if (!practiceText) {
    alert('Keine passenden Textstellen gefunden.');
    return;
  }

  window.dispatchEvent(new CustomEvent('practice', { detail: { practiceText } }));
  document.querySelector('.nav-btn[data-view="typing"]').click();
});
