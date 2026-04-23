import { getSessions, getAllKeystrokes, getKeystrokes } from './db.js';

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
    rates[ch] = { rate: d.total >= 3 ? d.errors / d.total : 0, total: d.total };
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

function getWordTimings(keystrokes) {
  if (!keystrokes.length) return [];
  const words = [];
  let wordStart = null;
  let wordText = '';
  let hasError = false;

  for (const k of keystrokes) {
    if (k.expected === ' ' || k.expected === '\n') {
      if (wordText.length > 0 && wordStart !== null) {
        words.push({ word: wordText, durationMs: k.timestampMs - wordStart, hasError });
      }
      wordText = '';
      wordStart = null;
      hasError = false;
    } else {
      if (wordStart === null) wordStart = k.timestampMs;
      wordText += k.expected;
      if (!k.correct) hasError = true;
    }
  }
  // last word (no trailing space)
  const last = keystrokes[keystrokes.length - 1];
  if (wordText.length > 0 && wordStart !== null) {
    words.push({ word: wordText, durationMs: last.timestampMs - wordStart, hasError });
  }
  return words;
}

// ── Render ───────────────────────────────────────────────────

async function renderAnalytics() {
  const [sessions, keystrokes] = await Promise.all([getSessions(50), getAllKeystrokes()]);

  renderWpmChart(getWpmHistory(sessions));
  renderHeatmap(getCharErrorRate(keystrokes));
  renderWeakWords(getWeakWords(keystrokes));
  renderBigrams(getWeakBigrams(keystrokes));

  // Word timing for the most recent session
  if (sessions.length > 0) {
    const latestKs = await getKeystrokes(sessions[0].id);
    renderWordTimingChart(getWordTimings(latestKs));
  } else {
    renderWordTimingChart([]);
  }
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

function renderWordTimingChart(words) {
  const svg = document.getElementById('word-timing-chart');
  const empty = document.getElementById('word-timing-empty');
  svg.innerHTML = '';

  if (words.length === 0) {
    svg.style.display = 'none';
    empty.style.display = '';
    return;
  }
  svg.style.display = '';
  empty.style.display = 'none';

  const W = svg.clientWidth || 700;
  const H = 140;
  const pad = { top: 10, right: 16, bottom: 32, left: 44 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  const durations = words.map(w => w.durationMs);
  const maxD = Math.max(...durations);
  const barW = Math.max(2, Math.min(28, (iW / words.length) - 2));

  // Y-axis labels (seconds)
  [0, maxD * 0.5, maxD].forEach(val => {
    const y = pad.top + iH - (val / maxD) * iH;
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', pad.left - 6);
    t.setAttribute('y', y + 4);
    t.setAttribute('text-anchor', 'end');
    t.setAttribute('font-size', '10');
    t.setAttribute('fill', 'rgba(255,255,255,0.25)');
    t.setAttribute('font-family', 'JetBrains Mono, monospace');
    t.textContent = (val / 1000).toFixed(1) + 's';
    svg.appendChild(t);

    // gridline
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', pad.left); line.setAttribute('x2', pad.left + iW);
    line.setAttribute('y1', y); line.setAttribute('y2', y);
    line.setAttribute('stroke', 'rgba(255,255,255,0.05)');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
  });

  words.forEach((w, i) => {
    const x = pad.left + (i / words.length) * iW + (iW / words.length - barW) / 2;
    const barH = (w.durationMs / maxD) * iH;
    const y = pad.top + iH - barH;

    const fill = w.hasError ? 'rgba(184,64,64,0.7)' : 'rgba(212,148,58,0.55)';

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barW);
    rect.setAttribute('height', barH);
    rect.setAttribute('fill', fill);
    rect.setAttribute('rx', '2');

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `"${w.word}" — ${(w.durationMs / 1000).toFixed(2)}s${w.hasError ? ' (Fehler)' : ''}`;
    rect.appendChild(title);
    svg.appendChild(rect);

    // word label below bar (only if bars wide enough)
    if (barW >= 12) {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', x + barW / 2);
      t.setAttribute('y', pad.top + iH + 14);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', '9');
      t.setAttribute('fill', 'rgba(255,255,255,0.2)');
      t.setAttribute('font-family', 'JetBrains Mono, monospace');
      t.textContent = w.word.length > 6 ? w.word.slice(0, 5) + '…' : w.word;
      svg.appendChild(t);
    }
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

  // heat scale: 0 = untouched, 1-2 = green (good), 3 = amber (ok), 4-5 = red (bad)
  function heatLevel(rate, total) {
    if (total < 3) return 0;
    if (rate <= 0.05) return 1;
    if (rate <= 0.15) return 2;
    if (rate <= 0.35) return 3;
    if (rate <= 0.60) return 4;
    return 5;
  }

  QWERTZ.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'heatmap-row';
    row.forEach(key => {
      const el = document.createElement('div');
      el.className = 'hkey';
      el.textContent = key;
      const stat = rates[key] || { rate: 0, total: 0 };
      const heat = heatLevel(stat.rate, stat.total);
      el.dataset.heat = heat;
      if (stat.total >= 3) {
        el.title = `${key}: ${Math.round(stat.rate * 100)}% Fehler (${stat.total}×)`;
      }
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
