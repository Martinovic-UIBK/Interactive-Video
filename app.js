// ============================================================
// app.js – Innsbruck Lernplattform (Chapter-Video-Modus)
// ============================================================

const BACKEND_URL = (() => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  return 'https://interactive-video-backend.onrender.com';
})();

// ===========================
// Auth
// ===========================
const token   = localStorage.getItem('ibk_token');
const userRaw = localStorage.getItem('ibk_user');
if (!token || !userRaw) { window.location.href = 'login.html'; throw new Error('Not authenticated'); }
const currentUser = JSON.parse(userRaw);

// ===========================
// State
// ===========================
let progressMap       = {};   // { chapterId: progressRow }
let ytPlayer          = null;
let ytApiReady        = false;
let pollInterval      = null;
let questionActive    = false;     // Frage gerade sichtbar?
let nextChapterIndex  = 0;         // Index des nächsten noch nicht gezeigten Kapitels
let sortOrder         = [];

window.onYouTubeIframeAPIReady = () => {
  ytApiReady = true;
  // Falls Autostart-Button bereits geklickt wurde
  if (window._pendingPlayerInit) {
    window._pendingPlayerInit();
    window._pendingPlayerInit = null;
  }
};

// ===========================
// Hilfsfunktionen
// ===========================

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}
function logout() {
  localStorage.removeItem('ibk_token');
  localStorage.removeItem('ibk_user');
  window.location.href = 'login.html';
}
function showToast(msg, type = 'info', dur = 4000) {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${{success:'✅',error:'❌',info:'ℹ️'}[type]||'ℹ️'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('fadeout'); t.addEventListener('animationend', () => t.remove()); }, dur);
}

// ===========================
// Fortschritt
// ===========================

function getCompletedCount() {
  return LESSON.chapters.filter(ch => progressMap[ch.id]?.is_correct).length;
}

function isChapterCompleted(chapterId) {
  return !!progressMap[chapterId]?.is_correct;
}

function updateProgressUI() {
  const done  = getCompletedCount();
  const total = LESSON.chapters.length;
  document.getElementById('progressCount').textContent = `${done} / ${total}`;
  document.getElementById('progressBar').style.width   = `${Math.round((done / total) * 100)}%`;
  renderChapterDots();
}

async function loadProgress() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/progress`, { headers: authHeaders() });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) throw new Error();
    const data = await res.json();
    progressMap = {};
    data.progress.forEach(row => { progressMap[row.station_number] = row; });
  } catch (_) {
    showToast('Fortschritt konnte nicht geladen werden.', 'error');
  }
}

async function saveProgressClientSide(chapterId, answerText, feedback) {
  try {
    await fetch(`${BACKEND_URL}/api/progress/complete/${chapterId}`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ answerText, feedback })
    });
    progressMap[chapterId] = {
      station_number: chapterId, video_watched: true,
      answer_text: answerText, is_correct: true, feedback
    };
    updateProgressUI();
  } catch (_) {}
}

async function saveVideoWatched(chapterId) {
  try {
    await fetch(`${BACKEND_URL}/api/progress/video-watched/${chapterId}`, {
      method: 'POST', headers: authHeaders()
    });
  } catch (_) {}
}

// ===========================
// Kapitel-Dots rendern
// ===========================

function renderChapterDots() {
  const container = document.getElementById('chapterDots');
  container.innerHTML = '';

  LESSON.chapters.forEach((ch, idx) => {
    const done = isChapterCompleted(ch.id);
    const dot  = document.createElement('div');
    dot.className = `chapter-dot ${done ? 'dot-done' : idx === nextChapterIndex ? 'dot-next' : 'dot-pending'}`;
    dot.title     = `${ch.icon} ${ch.title}${done ? ' ✅' : ''}`;
    dot.innerHTML = done ? '✓' : `${idx + 1}`;
    container.appendChild(dot);
  });
}

// ===========================
// Nächsten offenen Kapitel-Index ermitteln
// ===========================

function calcNextChapterIndex() {
  for (let i = 0; i < LESSON.chapters.length; i++) {
    if (!isChapterCompleted(LESSON.chapters[i].id)) {
      return i;
    }
  }
  return LESSON.chapters.length; // alle fertig
}

// ===========================
// YouTube Player initialisieren
// ===========================

function initPlayer() {
  const tryInit = () => {
    if (!ytApiReady || typeof YT === 'undefined' || !YT.Player) {
      window._pendingPlayerInit = tryInit;
      return;
    }

    // Startzeit: beim ersten noch nicht abgeschlossenen Kapitel beginnen
    const startChapter = LESSON.chapters[nextChapterIndex];
    const startSeconds = startChapter
      ? Math.max(0, startChapter.pauseAt - 30)
      : 0;

    ytPlayer = new YT.Player('yt-player', {
      videoId:     LESSON.youtubeId,
      playerVars:  { rel: 0, modestbranding: 1, playsinline: 1, start: startSeconds },
      events: {
        onReady:       onPlayerReady,
        onStateChange: onPlayerStateChange
      }
    });
  };
  tryInit();
}

function onPlayerReady() {
  // Overlay ausblenden sobald Player geladen ist
  document.getElementById('videoStartOverlay').style.display = 'none';
  ytPlayer.playVideo();
  startPolling();
}

function onPlayerStateChange(event) {
  // YT.PlayerState: PLAYING=1, PAUSED=2, ENDED=0
  if (event.data === 1) startPolling();
  if (event.data === 2 || event.data === 0) stopPolling();
  if (event.data === 0) onVideoEnded();
}

// ===========================
// Polling – erkennt Kapitel-Zeitstempel
// ===========================

function startPolling() {
  if (pollInterval) return;
  pollInterval = setInterval(() => {
    if (!ytPlayer || questionActive) return;

    const chapter = LESSON.chapters[nextChapterIndex];
    if (!chapter) { stopPolling(); return; }

    const time = ytPlayer.getCurrentTime();
    if (time >= chapter.pauseAt) {
      ytPlayer.pauseVideo();
      stopPolling();
      onChapterReached(chapter);
    }
  }, 400);
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

// ===========================
// Kapitel erreicht → Frage zeigen
// ===========================

function onChapterReached(chapter) {
  questionActive = true;
  saveVideoWatched(chapter.id);

  const completed = isChapterCompleted(chapter.id);
  const progress  = progressMap[chapter.id];

  // Kapitel-Badge setzen
  document.getElementById('panelChapterIcon').textContent = chapter.icon;
  document.getElementById('panelChapterNum').textContent  = `Kapitel ${chapter.id} – ${chapter.title}`;

  // Typ-Label
  const typeLabels = { single:'🔘 Einfachauswahl', multiple:'☑️ Mehrfachauswahl', open:'✏️ Offene Frage', sort:'↕️ Sortieraufgabe', estimate:'🎯 Schätzfrage' };
  document.getElementById('panelQuestionType').textContent = typeLabels[chapter.task?.type] || '✏️ Aufgabe';
  document.getElementById('panelQuestionText').textContent = chapter.task?.question || '';

  // Panels umschalten
  document.getElementById('panelWaiting').classList.add('hidden');
  document.getElementById('panelCompleted').classList.add('hidden');

  if (completed && progress) {
    showCompletedPanel(chapter, progress);
  } else {
    document.getElementById('panelQuestion').classList.remove('hidden');
    renderTaskUI(chapter.task, true);
  }
}

function showCompletedPanel(chapter, progress) {
  document.getElementById('panelQuestion').classList.add('hidden');
  document.getElementById('panelCompleted').classList.remove('hidden');
  document.getElementById('completedTitle').textContent    = `✅ ${chapter.title} – bereits beantwortet`;
  document.getElementById('completedFeedback').textContent = progress.feedback || '';

  document.getElementById('btnContinue').onclick = () => {
    continueVideo();
  };
}

// ===========================
// Video fortsetzen
// ===========================

function continueVideo() {
  questionActive = false;
  nextChapterIndex = calcNextChapterIndex();
  updateProgressUI();

  document.getElementById('panelQuestion').classList.add('hidden');
  document.getElementById('panelCompleted').classList.add('hidden');
  document.getElementById('panelWaiting').classList.remove('hidden');

  if (nextChapterIndex >= LESSON.chapters.length) {
    document.getElementById('panelWaiting').innerHTML = `
      <div class="waiting-icon">🏆</div>
      <p class="waiting-text">Herzlichen Glückwunsch! Du hast alle ${LESSON.chapters.length} Kapitel abgeschlossen!</p>
    `;
    return;
  }

  ytPlayer.playVideo();
  startPolling();
}

function onVideoEnded() {
  stopPolling();
  document.getElementById('panelWaiting').innerHTML = `
    <div class="waiting-icon">🎬</div>
    <p class="waiting-text">Video zu Ende! ${getCompletedCount() < LESSON.chapters.length ? 'Noch nicht alle Fragen beantwortet – spule zum nächsten Kapitel zurück.' : '🏆 Alle Kapitel abgeschlossen!'}</p>
  `;
  document.getElementById('panelWaiting').classList.remove('hidden');
  document.getElementById('panelQuestion').classList.add('hidden');
  document.getElementById('panelCompleted').classList.add('hidden');
}

// ===========================
// Aufgaben-UI rendern (identisch mit vorheriger Version)
// ===========================

function renderTaskUI(task, isEnabled) {
  const container = document.getElementById('taskContainer');
  container.innerHTML = '';
  sortOrder = [];

  if (task.type === 'open') {
    container.innerHTML = `
      <textarea class="answer-textarea" id="answerInput"
        placeholder="Schreibe hier deine Antwort…" rows="4"></textarea>
      <div class="submit-row">
        <button class="btn-submit" id="submitBtn" disabled>
          <span id="submitBtnText">Antwort senden</span>
        </button>
        <span class="submit-hint" id="submitHint">Mindestens 1 Wort eingeben</span>
      </div>
      <div class="feedback-box" id="feedbackBox">
        <div class="feedback-header" id="feedbackHeader"></div>
        <div class="feedback-text"  id="feedbackText"></div>
      </div>
    `;
    const ta = document.getElementById('answerInput');
    ta.focus();
    ta.addEventListener('input', () => {
      document.getElementById('submitBtn').disabled = ta.value.trim().length === 0;
    });
    document.getElementById('submitBtn').addEventListener('click', submitTask);
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitTask(); } });

  } else if (task.type === 'single' || task.type === 'multiple') {
    const isMulti = task.type === 'multiple';
    const opts = task.options.map((opt, i) => `
      <label class="choice-option ${isMulti ? 'choice-checkbox' : ''}" data-index="${i}">
        <span class="${isMulti ? 'choice-check' : 'choice-radio'}"></span>
        <span class="choice-text">${opt}</span>
      </label>
    `).join('');
    container.innerHTML = `
      <div class="choice-list">${opts}</div>
      <div class="submit-row">
        <button class="btn-submit" id="submitBtn" disabled>
          <span id="submitBtnText">Überprüfen</span>
        </button>
        <span class="submit-hint" id="submitHint">${isMulti ? 'Alle richtigen Antworten wählen' : 'Eine Antwort wählen'}</span>
      </div>
      <div class="feedback-box" id="feedbackBox">
        <div class="feedback-header" id="feedbackHeader"></div>
        <div class="feedback-text"  id="feedbackText"></div>
      </div>
    `;
    document.querySelectorAll('.choice-option').forEach(el => {
      el.addEventListener('click', () => {
        if (!isMulti) document.querySelectorAll('.choice-option').forEach(o => o.classList.remove('selected'));
        el.classList.toggle('selected');
        document.getElementById('submitBtn').disabled =
          document.querySelectorAll('.choice-option.selected').length === 0;
        document.getElementById('submitHint').textContent = '';
      });
    });
    document.getElementById('submitBtn').addEventListener('click', submitTask);

  } else if (task.type === 'sort') {
    sortOrder = task.items.map((_, i) => i);
    sortOrder = [...sortOrder.slice(1), sortOrder[0]];

    container.innerHTML = `
      <div class="sort-list" id="sortList"></div>
      <div class="submit-row" style="margin-top:14px">
        <button class="btn-submit" id="submitBtn">
          <span id="submitBtnText">Reihenfolge prüfen</span>
        </button>
        <span class="submit-hint" id="submitHint">Mit ▲ ▼ sortieren</span>
      </div>
      <div class="feedback-box" id="feedbackBox">
        <div class="feedback-header" id="feedbackHeader"></div>
        <div class="feedback-text"  id="feedbackText"></div>
      </div>
    `;
    renderSortList(task, true);
    document.getElementById('submitBtn').addEventListener('click', submitTask);

  } else if (task.type === 'estimate') {
    const midVal = Math.round((task.min + task.max) / 2);
    container.innerHTML = `
      <div class="estimate-wrapper">
        <div class="estimate-display">
          <span class="estimate-value" id="estimateValue">${midVal.toLocaleString('de-AT')}</span>
          <span class="estimate-unit">${task.unit}</span>
        </div>
        <div class="estimate-slider-row">
          <span class="estimate-bound">${task.min.toLocaleString('de-AT')}</span>
          <input type="range" class="estimate-slider" id="estimateSlider"
            min="${task.min}" max="${task.max}" step="${task.step}" value="${midVal}" />
          <span class="estimate-bound">${task.max.toLocaleString('de-AT')}</span>
        </div>
        <div class="estimate-result-track" id="estimateResultTrack" style="display:none">
          <div class="estimate-result-bar" id="estimateResultBar"></div>
          <div class="estimate-marker estimate-marker-user"    id="markerUser"></div>
          <div class="estimate-marker estimate-marker-correct" id="markerCorrect"></div>
        </div>
        <div class="estimate-legend" id="estimateLegend" style="display:none">
          <span class="legend-user">⬤ Deine Schätzung</span>
          <span class="legend-correct">⬤ Richtige Antwort</span>
        </div>
      </div>
      <div class="submit-row">
        <button class="btn-submit" id="submitBtn">
          <span id="submitBtnText">Schätzung abgeben</span>
        </button>
        <span class="submit-hint" id="submitHint">Schieberegler einstellen</span>
      </div>
      <div class="feedback-box" id="feedbackBox">
        <div class="feedback-header" id="feedbackHeader"></div>
        <div class="feedback-text"  id="feedbackText"></div>
      </div>
    `;
    document.getElementById('estimateSlider').addEventListener('input', e => {
      document.getElementById('estimateValue').textContent = Number(e.target.value).toLocaleString('de-AT');
    });
    document.getElementById('submitBtn').addEventListener('click', submitTask);
  }
}

function renderSortList(task, enabled) {
  const list = document.getElementById('sortList');
  if (!list) return;
  list.innerHTML = sortOrder.map((origIdx, pos) => `
    <div class="sort-item" data-pos="${pos}">
      <div class="sort-handle">
        <button class="sort-btn" data-dir="up"   data-pos="${pos}" ${pos === 0 ? 'disabled' : ''}>▲</button>
        <button class="sort-btn" data-dir="down" data-pos="${pos}" ${pos === sortOrder.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
      <span class="sort-text">${task.items[origIdx]}</span>
    </div>
  `).join('');

  list.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const pos = parseInt(btn.dataset.pos, 10);
      if (btn.dataset.dir === 'up' && pos > 0)
        [sortOrder[pos], sortOrder[pos-1]] = [sortOrder[pos-1], sortOrder[pos]];
      else if (btn.dataset.dir === 'down' && pos < sortOrder.length - 1)
        [sortOrder[pos], sortOrder[pos+1]] = [sortOrder[pos+1], sortOrder[pos]];
      renderSortList(task, true);
    });
  });
}

// ===========================
// Aufgabe einreichen
// ===========================

async function submitTask() {
  const chapter = LESSON.chapters[nextChapterIndex];
  if (!chapter) return;
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn?.disabled) return;

  if (chapter.task.type === 'open') {
    await submitOpenQuestion(chapter);
  } else {
    submitClientSide(chapter);
  }
}

function submitClientSide(chapter) {
  const task = chapter.task;
  const submitBtn  = document.getElementById('submitBtn');
  const submitHint = document.getElementById('submitHint');
  let isCorrect = false;
  let answerText = '';

  if (task.type === 'single') {
    const sel = document.querySelector('.choice-option.selected');
    if (!sel) return;
    const idx = parseInt(sel.dataset.index, 10);
    isCorrect  = idx === task.correct;
    answerText = task.options[idx];
    document.querySelectorAll('.choice-option').forEach(el => {
      const i = parseInt(el.dataset.index, 10);
      el.classList.remove('selected');
      if (i === task.correct) el.classList.add('correct-answer');
      else if (i === idx && !isCorrect) el.classList.add('wrong-answer');
      el.style.pointerEvents = 'none';
    });

  } else if (task.type === 'multiple') {
    const sel = [...document.querySelectorAll('.choice-option.selected')].map(el => parseInt(el.dataset.index,10));
    isCorrect  = JSON.stringify([...sel].sort()) === JSON.stringify([...task.correct].sort());
    answerText = sel.map(i => task.options[i]).join(', ');
    document.querySelectorAll('.choice-option').forEach(el => {
      const i = parseInt(el.dataset.index,10);
      if (task.correct.includes(i)) el.classList.add('correct-answer');
      else if (sel.includes(i))     el.classList.add('wrong-answer');
      el.style.pointerEvents = 'none';
    });

  } else if (task.type === 'sort') {
    isCorrect  = JSON.stringify(sortOrder) === JSON.stringify(task.items.map((_,i) => i));
    answerText = sortOrder.map(i => task.items[i]).join(' → ');
    document.querySelectorAll('.sort-item').forEach((el, pos) => {
      el.classList.add(sortOrder[pos] === pos ? 'sort-correct' : 'sort-wrong');
    });
    document.querySelectorAll('.sort-btn').forEach(b => b.disabled = true);

  } else if (task.type === 'estimate') {
    const slider  = document.getElementById('estimateSlider');
    const guessed = Number(slider.value);
    const diff    = Math.abs(guessed - task.correct);
    isCorrect     = diff <= task.tolerance;
    answerText    = `${guessed.toLocaleString('de-AT')} ${task.unit}`;
    slider.disabled = true;

    const range      = task.max - task.min;
    const userPct    = ((guessed      - task.min) / range) * 100;
    const correctPct = ((task.correct - task.min) / range) * 100;
    const track = document.getElementById('estimateResultTrack');
    track.style.display = 'block';
    document.getElementById('estimateLegend').style.display = 'flex';
    document.getElementById('markerUser').style.left    = `${userPct}%`;
    document.getElementById('markerCorrect').style.left = `${correctPct}%`;

    if (!isCorrect) {
      showFeedback(false, `Knapp daneben! Du lagst ${diff.toLocaleString('de-AT')} ${task.unit} neben der richtigen Antwort. ${task.feedback}`);
      submitBtn.disabled = false;
      document.getElementById('submitBtnText').textContent = 'Nochmal versuchen';
      submitHint.textContent = 'Passe deinen Schieberegler an';
      setTimeout(() => {
        slider.disabled = false;
        track.style.display = 'none';
        document.getElementById('estimateLegend').style.display = 'none';
      }, 2000);
      return;
    }
    answerText = `${guessed.toLocaleString('de-AT')} ${task.unit} (±${diff})`;
  }

  let feedbackText = isCorrect ? task.feedback : '❌ Noch nicht ganz – schau dir die markierten Elemente an!';
  if (task.type === 'sort' && !isCorrect) feedbackText = 'Noch nicht richtig – versuche es nochmal!';

  showFeedback(isCorrect, feedbackText);

  if (isCorrect) {
    submitBtn.disabled = true;
    submitHint.textContent = '';
    saveProgressClientSide(chapter.id, answerText, task.feedback);
    setTimeout(() => afterCorrectAnswer(chapter, task.feedback), 1200);
  } else {
    submitBtn.disabled = false;
    document.getElementById('submitBtnText').textContent = 'Nochmal versuchen';
    if (task.type === 'sort') setTimeout(() => renderTaskUI(task, true), 1800);
  }
}

async function submitOpenQuestion(chapter) {
  const ta  = document.getElementById('answerInput');
  const txt = ta?.value.trim();
  if (!txt) return;

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  ta.disabled = true;
  document.getElementById('submitHint').textContent = 'Gemini AI bewertet…';
  document.getElementById('feedbackBox').className = 'feedback-box';

  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  submitBtn.prepend(spinner);
  document.getElementById('submitBtnText').textContent = 'KI bewertet…';

  try {
    const res = await fetch(`${BACKEND_URL}/api/evaluate`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({
        stationId: chapter.id,
        question:  chapter.task.question,
        keyInfo:   chapter.task.keyInfo,
        answer:    txt
      })
    });
    if (res.status === 401) { logout(); return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    spinner.remove();

    showFeedback(data.correct, data.feedback);

    if (data.correct) {
      submitBtn.disabled = true;
      progressMap[chapter.id] = {
        station_number: chapter.id, video_watched: true,
        answer_text: txt, is_correct: true, feedback: data.feedback
      };
      updateProgressUI();
      setTimeout(() => afterCorrectAnswer(chapter, data.feedback), 1200);
    } else {
      submitBtn.disabled = false;
      ta.disabled = false;
      document.getElementById('submitBtnText').textContent = 'Nochmal versuchen';
      document.getElementById('submitHint').textContent = 'Schreibe eine neue Antwort';
    }
  } catch (err) {
    spinner.remove();
    showFeedback(false, `Fehler: ${err.message}`);
    submitBtn.disabled = false;
    ta.disabled = false;
    document.getElementById('submitBtnText').textContent = 'Nochmal senden';
  }
}

// ===========================
// Nach richtiger Antwort
// ===========================

function afterCorrectAnswer(chapter, feedback) {
  nextChapterIndex = calcNextChapterIndex();
  updateProgressUI();

  // Frage-Panel → "Weiter"-Panel
  document.getElementById('panelQuestion').classList.add('hidden');
  document.getElementById('panelCompleted').classList.remove('hidden');
  document.getElementById('completedTitle').textContent    = `✅ ${chapter.title} – Super gemacht!`;
  document.getElementById('completedFeedback').textContent = feedback || '';

  const btnContinue = document.getElementById('btnContinue');

  if (nextChapterIndex >= LESSON.chapters.length) {
    btnContinue.textContent = '🏆 Alle Kapitel abgeschlossen!';
    btnContinue.onclick = () => onVideoEnded();
    showToast('🏆 Alle Kapitel abgeschlossen! Herzlichen Glückwunsch!', 'success', 7000);
  } else {
    const next = LESSON.chapters[nextChapterIndex];
    btnContinue.textContent = `▶ Weiter zu: ${next.icon} ${next.title}`;
    btnContinue.onclick = () => continueVideo();
    showToast(`🎉 Kapitel ${chapter.id} abgeschlossen!`, 'success');
  }
}

function showFeedback(correct, text) {
  const box = document.getElementById('feedbackBox');
  const hdr = document.getElementById('feedbackHeader');
  const bdy = document.getElementById('feedbackText');
  if (!box) return;
  box.className = `feedback-box ${correct ? 'correct' : 'incorrect'} visible`;
  hdr.className = `feedback-header ${correct ? 'correct' : 'incorrect'}`;
  hdr.textContent = correct ? '✅ Richtig!' : '❌ Noch nicht ganz…';
  bdy.textContent = String(text).replace(/^[✅❌]\s*/,'');
}

// ===========================
// DOMContentLoaded
// ===========================

document.addEventListener('DOMContentLoaded', async () => {
  // User-Info
  document.getElementById('userNameDisplay').textContent = currentUser.username;
  document.getElementById('userAvatar').textContent = currentUser.username.charAt(0).toUpperCase();
  document.getElementById('logoutBtn').addEventListener('click', logout);

  // Lesson-Titel
  document.getElementById('startTitle').textContent    = LESSON.title;
  document.getElementById('progressTitle').textContent = LESSON.title;

  // Fortschritt laden
  await loadProgress();

  // Nächstes Kapitel berechnen
  nextChapterIndex = calcNextChapterIndex();
  updateProgressUI();

  // Start-Overlay: Video starten
  document.getElementById('startVideoBtn').addEventListener('click', () => {
    document.getElementById('videoStartOverlay').style.display = 'none';
    initPlayer();
  });

  // Chatbot
  initChatbot();
});

// ===========================
// Chatbot
// ===========================

function initChatbot() {
  const fab     = document.getElementById('chatFab');
  const heroBtn = document.getElementById('chatHeroBtn');
  const win     = document.getElementById('chatWindow');
  const closeBtn= document.getElementById('chatClose');
  const input   = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSend');
  const msgs    = document.getElementById('chatMessages');
  let isOpen = false;

  const open  = () => { isOpen=true;  win.classList.add('open');    win.setAttribute('aria-hidden','false'); input.focus(); };
  const close = () => { isOpen=false; win.classList.remove('open'); win.setAttribute('aria-hidden','true'); };

  fab.addEventListener('click',                  () => isOpen ? close() : open());
  if (heroBtn) heroBtn.addEventListener('click', () => isOpen ? close() : open());
  closeBtn.addEventListener('click', close);
  sendBtn.addEventListener('click', sendMsg);
  input.addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); sendMsg(); } });

  function addBubble(html, type) {
    const b = document.createElement('div');
    b.className = `chat-bubble chat-bubble-${type}`;
    b.innerHTML = html;
    msgs.appendChild(b);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function sendMsg() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendBtn.disabled = input.disabled = true;
    addBubble(text, 'user');
    const typing = document.createElement('div');
    typing.className='chat-typing'; typing.id='chatTyping';
    typing.innerHTML='<span></span><span></span><span></span>';
    msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
    try {
      const res  = await fetch(`${BACKEND_URL}/api/chat`, {
        method:'POST', headers: authHeaders(), body: JSON.stringify({ message: text })
      });
      document.getElementById('chatTyping')?.remove();
      if (res.status===401) { logout(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message||'Fehler');
      addBubble(data.reply, 'bot');
    } catch (err) {
      document.getElementById('chatTyping')?.remove();
      addBubble(`⚠️ ${err.message}`, 'error');
    } finally {
      sendBtn.disabled = input.disabled = false;
      input.focus();
    }
  }
}
