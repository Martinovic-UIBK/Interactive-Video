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
let questionActive    = false;
let nextChapterIndex  = 0;
let sortOrder         = [];
let attemptsMap       = {};   // { chapterId: attemptCount }
let botInteractions   = {};   // { chapterId: true } — tracks if user used bot during this question
let deferredChapters  = [];   // chapter ids deferred via "Später erledigen"

function pointsForAttempts(n) {
  if (n <= 1) return 10;
  if (n === 2) return 8;
  if (n === 3) return 5;
  return 3;
}

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

function getTotalPoints() {
  return LESSON.chapters.reduce((sum, ch) => {
    const row = progressMap[ch.id];
    return sum + (row?.is_correct ? (row.points || 0) : 0);
  }, 0);
}

function updateProgressUI() {
  const done  = getCompletedCount();
  const total = LESSON.chapters.length;
  document.getElementById('progressCount').textContent = `${done} / ${total}`;
  document.getElementById('progressBar').style.width   = `${Math.round((done / total) * 100)}%`;
  const pts = document.getElementById('pointsDisplay');
  if (pts) pts.textContent = `⭐ ${getTotalPoints()} Punkte`;
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
  const attempts = attemptsMap[chapterId] || 1;
  const points   = pointsForAttempts(attempts);
  try {
    await fetch(`${BACKEND_URL}/api/progress/complete/${chapterId}`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ answerText, feedback, points, attempts })
    });
    progressMap[chapterId] = {
      station_number: chapterId, video_watched: true,
      answer_text: answerText, is_correct: true, feedback, points, attempts
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
    const ch = LESSON.chapters[i];
    if (!isChapterCompleted(ch.id) && !deferredChapters.includes(ch.id)) {
      return i;
    }
  }
  return LESSON.chapters.length;
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
      playerVars:  { rel: 0, modestbranding: 1, playsinline: 1, start: startSeconds, html5: 1, origin: window.location.origin },
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
  if (event.data === 1) {
    if (questionActive) {
      // Frage noch nicht beantwortet – sofort wieder pausieren
      ytPlayer.pauseVideo();
      const overlay = document.getElementById('videoQuestionOverlay');
      if (overlay) {
        overlay.classList.add('show-warning');
        setTimeout(() => overlay.classList.remove('show-warning'), 2500);
      }
      return;
    }
    startPolling();
  }
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

    // Skip-Sperre: nicht über nächste Frage hinaus spulen
    if (time > chapter.pauseAt + 1) {
      ytPlayer.seekTo(Math.max(0, chapter.pauseAt - 2));
      showToast('⚠️ Beantworte zuerst die nächste Frage!', 'error', 2500);
      return;
    }

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

  // TTS button — placed after question text for visibility
  const existingTts = document.getElementById('ttsBtn');
  if (existingTts) existingTts.remove();
  const ttsBtn = document.createElement('button');
  ttsBtn.className = 'btn-tts';
  ttsBtn.id = 'ttsBtn';
  ttsBtn.innerHTML = '🔊 <span class="tts-label">Vorlesen</span>';
  ttsBtn.title = 'Frage vorlesen';
  ttsBtn.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    const isEnglish = chapter.id === 1 || chapter.id === 8;
    const lang = isEnglish ? 'en-US' : 'de-DE';
    let text = chapter.task?.question || '';
    if ((chapter.task?.type === 'single' || chapter.task?.type === 'multiple') && Array.isArray(chapter.task?.options)) {
      const labels = ['A', 'B', 'C', 'D'];
      const prefix = isEnglish ? 'Answer' : 'Antwort';
      const optionsText = chapter.task.options
        .map((opt, i) => `${prefix} ${labels[i] || (i + 1)}: ${opt}`)
        .join('. ');
      text += ' ... ' + optionsText + '.';
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.filter(v => {
      const nameMatch = /google|samantha|daniel/i.test(v.name);
      const langMatch = v.lang.startsWith(isEnglish ? 'en' : 'de');
      return nameMatch && langMatch;
    });
    if (preferred.length > 0) {
      utter.voice = preferred[0];
    } else {
      const langVoice = voices.find(v => v.lang.startsWith(isEnglish ? 'en' : 'de'));
      if (langVoice) utter.voice = langVoice;
    }
    ttsBtn.classList.add('tts-active');
    utter.onend = () => ttsBtn.classList.remove('tts-active');
    window.speechSynthesis.speak(utter);
  });
  const questionText = document.getElementById('panelQuestionText');
  questionText.parentNode.insertBefore(ttsBtn, questionText.nextSibling);

  // Video sperren
  const vqo = document.getElementById('videoQuestionOverlay');
  if (vqo) vqo.style.display = 'flex';

  // Panels umschalten
  document.getElementById('panelWaiting').classList.add('hidden');
  document.getElementById('panelCompleted').classList.add('hidden');

  if (completed && progress) {
    showCompletedPanel(chapter, progress);
  } else {
    document.getElementById('panelQuestion').classList.remove('hidden');
    renderTaskUI(chapter.task, true);
    addSkipButton(chapter);
  }
}

// ===========================
// Später erledigen (Skip/Defer)
// ===========================

function canSkip(chapterId) {
  if (chapterId === 7 || chapterId === 13) return true;
  return (attemptsMap[chapterId] || 0) >= 2 && botInteractions[chapterId];
}

function addSkipButton(chapter) {
  const existing = document.getElementById('skipSection');
  if (existing) existing.remove();

  const container = document.getElementById('taskContainer');
  const section = document.createElement('div');
  section.id = 'skipSection';

  const btn = document.createElement('button');
  btn.className = 'btn-skip-question';
  btn.id = 'skipBtn';
  btn.innerHTML = '⏭ Später erledigen';

  const hint = document.createElement('div');
  hint.className = 'skip-hint';
  hint.id = 'skipHint';

  section.appendChild(btn);
  section.appendChild(hint);
  container.appendChild(section);

  btn.addEventListener('click', () => {
    if (!canSkip(chapter.id)) return;
    deferQuestion(chapter);
  });

  updateSkipButton(chapter);
}

function updateSkipButton(chapter) {
  const btn = document.getElementById('skipBtn');
  const hint = document.getElementById('skipHint');
  if (!btn || !hint) return;

  const attempts = attemptsMap[chapter.id] || 0;
  const usedBot = !!botInteractions[chapter.id];
  const unlocked = canSkip(chapter.id);

  btn.disabled = !unlocked;

  if (unlocked) {
    hint.innerHTML = '⚠️ Du erhältst <strong>0 Punkte</strong> für diese Aufgabe.';
  } else {
    const needs = [];
    if (attempts < 2) needs.push(`noch ${2 - attempts}× versuchen`);
    if (!usedBot) needs.push('1× den KI-Bot fragen');
    hint.innerHTML = `🔒 Erst verfügbar nach: ${needs.join(' und ')}`;
  }
}

function deferQuestion(chapter) {
  if (!deferredChapters.includes(chapter.id)) {
    deferredChapters.push(chapter.id);
  }
  questionActive = false;
  const vqo = document.getElementById('videoQuestionOverlay');
  if (vqo) vqo.style.display = 'none';

  nextChapterIndex = calcNextChapterIndex();
  updateProgressUI();

  document.getElementById('panelQuestion').classList.add('hidden');
  document.getElementById('panelCompleted').classList.add('hidden');
  document.getElementById('panelWaiting').classList.remove('hidden');
  document.getElementById('panelWaiting').innerHTML = `
    <div class="waiting-icon">⏭</div>
    <p class="waiting-text">Frage übersprungen – du kommst später darauf zurück.</p>
  `;

  showToast('⏭ Frage wird später wiederholt – 0 Punkte', 'info', 3000);

  if (nextChapterIndex >= LESSON.chapters.length && deferredChapters.length > 0) {
    setTimeout(() => returnToDeferredQuestions(), 2000);
  } else {
    ytPlayer.playVideo();
    startPolling();
  }
}

function returnToDeferredQuestions() {
  if (deferredChapters.length === 0) return;
  const nextDeferredId = deferredChapters[0];
  const chapter = LESSON.chapters.find(ch => ch.id === nextDeferredId);
  if (!chapter) { deferredChapters.shift(); return returnToDeferredQuestions(); }

  showToast(`⏪ Zurück zu: ${chapter.title}`, 'info', 3000);
  ytPlayer.seekTo(Math.max(0, chapter.pauseAt - 2));
  ytPlayer.playVideo();

  setTimeout(() => {
    ytPlayer.pauseVideo();
    deferredChapters.shift();
    onChapterReached(chapter);
  }, 1500);
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
  const vqo = document.getElementById('videoQuestionOverlay');
  if (vqo) vqo.style.display = 'none';
  nextChapterIndex = calcNextChapterIndex();
  updateProgressUI();

  document.getElementById('panelQuestion').classList.add('hidden');
  document.getElementById('panelCompleted').classList.add('hidden');
  document.getElementById('panelWaiting').classList.remove('hidden');

  if (nextChapterIndex >= LESSON.chapters.length) {
    document.getElementById('panelWaiting').innerHTML = `
      <div class="waiting-icon">🏆</div>
      <p class="waiting-text">Alle Fragen beantwortet! Das Video läuft weiter bis zum Ende.</p>
    `;
    ytPlayer.playVideo();
    return;
  }

  ytPlayer.playVideo();
  startPolling();
}

function onVideoEnded() {
  stopPolling();
  if (getCompletedCount() >= LESSON.chapters.length) {
    showCompletionScreen();
    return;
  }
  if (deferredChapters.length > 0) {
    returnToDeferredQuestions();
    return;
  }
  document.getElementById('panelWaiting').innerHTML = `
    <div class="waiting-icon">🎬</div>
    <p class="waiting-text">Video zu Ende! Noch nicht alle Fragen beantwortet – spule zum nächsten Kapitel zurück.</p>
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
    document.querySelectorAll('.choice-option').forEach((el, idx) => {
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      const selectOption = () => {
        if (document.getElementById('submitBtn')?.dataset.timerActive) return;
        if (!isMulti) document.querySelectorAll('.choice-option').forEach(o => o.classList.remove('selected'));
        el.classList.toggle('selected');
        document.getElementById('submitBtn').disabled =
          document.querySelectorAll('.choice-option.selected').length === 0;
        document.getElementById('submitHint').textContent = '';
      };
      el.addEventListener('click', selectOption);
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectOption(); }
        const options = [...document.querySelectorAll('.choice-option')];
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); options[Math.min(idx+1, options.length-1)]?.focus(); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); options[Math.max(idx-1, 0)]?.focus(); }
      });
    });
    document.querySelectorAll('.choice-option')[0]?.focus();
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

  } else if (task.type === 'estimate_double') {
    const sliders = task.estimates.map((est, i) => {
      const midVal = Math.round((est.min + est.max) / 2);
      return `
        <div class="estimate-double-item">
          <div class="estimate-double-label">${est.label}</div>
          <div class="estimate-display">
            <span class="estimate-value" id="estimateValue${i}">${midVal.toLocaleString('de-AT')}</span>
            <span class="estimate-unit">${est.unit}</span>
          </div>
          <div class="estimate-slider-row">
            <span class="estimate-bound">${est.min.toLocaleString('de-AT')}</span>
            <input type="range" class="estimate-slider" id="estimateSlider${i}"
              min="${est.min}" max="${est.max}" step="${est.step}" value="${midVal}" />
            <span class="estimate-bound">${est.max.toLocaleString('de-AT')}</span>
          </div>
          <div class="estimate-result-track" id="estimateResultTrack${i}" style="display:none">
            <div class="estimate-result-bar"></div>
            <div class="estimate-marker estimate-marker-user"    id="markerUser${i}"></div>
            <div class="estimate-marker estimate-marker-correct" id="markerCorrect${i}"></div>
          </div>
        </div>
      `;
    }).join('<hr class="estimate-divider">');

    container.innerHTML = `
      <div class="estimate-wrapper">
        ${sliders}
        <div class="estimate-legend" id="estimateLegend" style="display:none">
          <span class="legend-user">⬤ Deine Schätzung</span>
          <span class="legend-correct">⬤ Richtige Antwort</span>
        </div>
      </div>
      <div class="submit-row">
        <button class="btn-submit" id="submitBtn">
          <span id="submitBtnText">Schätzungen abgeben</span>
        </button>
        <span class="submit-hint" id="submitHint">Beide Schieberegler einstellen</span>
      </div>
      <div class="feedback-box" id="feedbackBox">
        <div class="feedback-header" id="feedbackHeader"></div>
        <div class="feedback-text"  id="feedbackText"></div>
      </div>
    `;
    task.estimates.forEach((_, i) => {
      document.getElementById(`estimateSlider${i}`).addEventListener('input', e => {
        document.getElementById(`estimateValue${i}`).textContent = Number(e.target.value).toLocaleString('de-AT');
      });
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
    if (isCorrect) {
      document.querySelectorAll('.choice-option').forEach(el => {
        const i = parseInt(el.dataset.index, 10);
        if (i === task.correct) el.classList.add('correct-answer');
        el.style.pointerEvents = 'none';
      });
    }

  } else if (task.type === 'multiple') {
    const sel = [...document.querySelectorAll('.choice-option.selected')].map(el => parseInt(el.dataset.index,10));
    isCorrect  = JSON.stringify([...sel].sort()) === JSON.stringify([...task.correct].sort());
    answerText = sel.map(i => task.options[i]).join(', ');
    // Immer korrekte Antworten grün markieren und Optionen sperren
    document.querySelectorAll('.choice-option').forEach(el => {
      const i = parseInt(el.dataset.index,10);
      if (task.correct.includes(i)) el.classList.add('correct-answer');
      el.style.pointerEvents = 'none';
    });

  } else if (task.type === 'sort') {
    isCorrect  = JSON.stringify(sortOrder) === JSON.stringify(task.items.map((_,i) => i));
    answerText = sortOrder.map(i => task.items[i]).join(' → ');
    if (isCorrect) {
      document.querySelectorAll('.sort-item').forEach((el, pos) => {
        el.classList.add('sort-correct');
      });
      document.querySelectorAll('.sort-btn').forEach(b => b.disabled = true);
    }

  } else if (task.type === 'estimate_double') {
    const results = task.estimates.map((est, i) => {
      const val  = Number(document.getElementById(`estimateSlider${i}`).value);
      const diff = Math.abs(val - est.correct);
      return { val, diff, ok: diff <= est.tolerance };
    });
    isCorrect  = results.every(r => r.ok);
    answerText = results.map((r, i) => `${task.estimates[i].label}: ${r.val.toLocaleString('de-AT')} ${task.estimates[i].unit}`).join(' | ');

    if (!isCorrect) {
      const hints = results.map((r, i) => {
        if (r.ok) return `✅ ${task.estimates[i].label}: passt!`;
        const dir = r.val < task.estimates[i].correct ? '📈 höher' : '📉 niedriger';
        return `${dir} (${task.estimates[i].label})`;
      }).join('  ');
      task.estimates.forEach((_, i) => { document.getElementById(`estimateSlider${i}`).disabled = false; });
      showFeedback(false, hints);
      startRetryTimer(chapter, 10, () => {
        task.estimates.forEach((_, i) => { document.getElementById(`estimateSlider${i}`).disabled = false; });
        const btn = document.getElementById('submitBtn');
        if (btn) { btn.disabled = false; document.getElementById('submitBtnText').textContent = 'Schätzungen abgeben'; }
        const hint = document.getElementById('submitHint');
        if (hint) hint.textContent = 'Schieberegler anpassen und nochmal versuchen';
      });
      return;
    }
    // Richtig: Visualisierung 10s zeigen
    document.getElementById('estimateLegend').style.display = 'flex';
    task.estimates.forEach((est, i) => {
      document.getElementById(`estimateSlider${i}`).disabled = true;
      const range      = est.max - est.min;
      const userPct    = ((results[i].val - est.min) / range) * 100;
      const correctPct = ((est.correct    - est.min) / range) * 100;
      document.getElementById(`estimateResultTrack${i}`).style.display = 'block';
      document.getElementById(`markerUser${i}`).style.left    = `${userPct}%`;
      document.getElementById(`markerCorrect${i}`).style.left = `${correctPct}%`;
    });

  } else if (task.type === 'estimate') {
    const slider  = document.getElementById('estimateSlider');
    const guessed = Number(slider.value);
    const diff    = Math.abs(guessed - task.correct);
    isCorrect     = diff <= task.tolerance;
    answerText    = `${guessed.toLocaleString('de-AT')} ${task.unit}`;
    slider.disabled = true;

    if (!isCorrect) {
      const direction = guessed < task.correct ? '📈 Der richtige Wert ist höher!' : '📉 Der richtige Wert ist niedriger!';
      slider.disabled = false;
      showFeedback(false, direction);
      startRetryTimer(chapter, 10, () => {
        slider.disabled = false;
        const btn = document.getElementById('submitBtn');
        if (btn) { btn.disabled = false; document.getElementById('submitBtnText').textContent = 'Schätzung abgeben'; }
        const hint = document.getElementById('submitHint');
        if (hint) hint.textContent = 'Schieberegler anpassen und nochmal versuchen';
      });
      return;
    }
  }

  let feedbackText = isCorrect ? task.feedback : '';

  showFeedback(isCorrect, feedbackText);

  if (isCorrect) {
    submitBtn.disabled = true;
    submitHint.textContent = '';
    saveProgressClientSide(chapter.id, answerText, task.feedback);
    setTimeout(() => afterCorrectAnswer(chapter, task.feedback), 1200);
  } else {
    attemptsMap[chapter.id] = (attemptsMap[chapter.id] || 1) + 1;
    updateSkipButton(chapter);
    if (task.rewindTo != null) {
      startRetryTimer(chapter, 10, () => {
        document.getElementById('panelQuestion').classList.add('hidden');
        document.getElementById('panelWaiting').classList.remove('hidden');
        questionActive = false;
        ytPlayer.seekTo(task.rewindTo);
        ytPlayer.playVideo();
        showToast('⏪ Schau dir den Abschnitt nochmal an!', 'info', 3000);
      });
    } else {
      startRetryTimer(chapter, 10);
    }
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
        answer:    txt,
        points:    pointsForAttempts(attemptsMap[chapter.id] || 1),
        attempts:  attemptsMap[chapter.id] || 1
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
      ta.disabled = false;
      attemptsMap[chapter.id] = (attemptsMap[chapter.id] || 1) + 1;
      updateSkipButton(chapter);
      if (chapter.task.rewindTo != null) {
        startRetryTimer(chapter, 10, () => {
          // Video zum Wiederholungs-Zeitstempel zurückspulen
          document.getElementById('panelQuestion').classList.add('hidden');
          document.getElementById('panelWaiting').classList.remove('hidden');
          questionActive = false;
          ytPlayer.seekTo(chapter.task.rewindTo);
          ytPlayer.playVideo();
          showToast('⏪ Schau dir den Abschnitt nochmal an!', 'info', 3000);
        });
      } else {
        startRetryTimer(chapter, 10);
      }
    }
  } catch (err) {
    spinner.remove();
    const fallbackFeedback = chapter.task.feedback || 'Gut gemacht! Deine Antwort wurde akzeptiert.';
    showFeedback(true, fallbackFeedback);
    submitBtn.disabled = true;
    progressMap[chapter.id] = {
      station_number: chapter.id, video_watched: true,
      answer_text: txt, is_correct: true, feedback: fallbackFeedback
    };
    updateProgressUI();
    setTimeout(() => afterCorrectAnswer(chapter, fallbackFeedback), 1200);
  }
}

// ===========================
// Nach richtiger Antwort
// ===========================

function afterCorrectAnswer(chapter, feedback) {
  nextChapterIndex = calcNextChapterIndex();
  updateProgressUI();

  const earnedPts = pointsForAttempts(attemptsMap[chapter.id] || 1);

  document.getElementById('panelQuestion').classList.add('hidden');
  document.getElementById('panelCompleted').classList.remove('hidden');
  document.getElementById('completedTitle').textContent    = `✅ ${chapter.title} – Super gemacht! (+${earnedPts} Punkte)`;
  document.getElementById('completedFeedback').textContent = feedback || '';

  const btnContinue = document.getElementById('btnContinue');

  if (nextChapterIndex >= LESSON.chapters.length) {
    btnContinue.textContent = '🎉 Ergebnis ansehen';
    btnContinue.onclick = () => {
      continueVideo();
      showCompletionScreen();
    };
    showToast(`🏆 Letzte Frage geschafft! +${earnedPts} Punkte`, 'success', 4000);
  } else {
    btnContinue.textContent = '▶ Weiter mit dem Video';
    btnContinue.onclick = () => continueVideo();
    showToast(`🎉 +${earnedPts} Punkte!`, 'success', 2500);
  }
}

function showCompletionScreen() {
  document.getElementById('scoreboardModal').classList.remove('open');
  const total = getTotalPoints();
  const done  = LESSON.chapters.filter(ch => progressMap[ch.id]?.is_correct).length;
  const el    = document.getElementById('completionScreen');
  document.getElementById('completionPoints').textContent = total;
  document.getElementById('completionChapters').textContent = done;
  el.classList.add('visible');
}

// ===========================
// Urkunde als PDF herunterladen
// ===========================

function downloadCertificate() {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1132;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // Background
  ctx.fillStyle = '#0f1923';
  ctx.fillRect(0, 0, w, h);

  // Gradient overlay
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, 'rgba(0,153,204,0.08)');
  grad.addColorStop(0.5, 'rgba(0,212,255,0.04)');
  grad.addColorStop(1, 'rgba(0,100,180,0.06)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Border
  ctx.strokeStyle = 'rgba(0,212,255,0.3)';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, w - 80, h - 80);
  ctx.strokeStyle = 'rgba(0,212,255,0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(52, 52, w - 104, h - 104);

  // Corner decorations
  const cornerSize = 30;
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 3;
  [[55, 55, 1, 1], [w-55, 55, -1, 1], [55, h-55, 1, -1], [w-55, h-55, -1, -1]].forEach(([x, y, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y + cornerSize * dy);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerSize * dx, y);
    ctx.stroke();
  });

  // Top badge
  ctx.fillStyle = 'rgba(0,212,255,0.12)';
  const badgeW = 320, badgeH = 32, badgeX = (w - badgeW) / 2, badgeY = 100;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 16);
  ctx.fill();
  ctx.font = '600 11px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#00d4ff';
  ctx.textAlign = 'center';
  ctx.fillText('UNIVERSITÄT INNSBRUCK · LERNPLATTFORM', w / 2, badgeY + 21);

  // Title
  ctx.font = '800 52px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('URKUNDE', w / 2, 210);

  // Subtitle line
  ctx.strokeStyle = 'rgba(0,212,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 120, 235);
  ctx.lineTo(w / 2 + 120, 235);
  ctx.stroke();

  // "hiermit wird bestätigt, dass"
  ctx.font = '400 18px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#9090a8';
  ctx.fillText('Hiermit wird bestätigt, dass', w / 2, 290);

  // Username
  ctx.font = '700 42px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#00d4ff';
  ctx.fillText(currentUser.username, w / 2, 355);

  // Underline under name
  const nameWidth = ctx.measureText(currentUser.username).width;
  ctx.strokeStyle = 'rgba(0,212,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(w / 2 - nameWidth / 2 - 20, 370);
  ctx.lineTo(w / 2 + nameWidth / 2 + 20, 370);
  ctx.stroke();

  // Description
  ctx.font = '400 18px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#9090a8';
  ctx.fillText('die interaktive Stadttour durch Innsbruck', w / 2, 420);
  ctx.fillText('erfolgreich abgeschlossen hat.', w / 2, 448);

  // Stats box
  const boxW = 500, boxH = 80, boxX = (w - boxW) / 2, boxY = 490;
  ctx.fillStyle = 'rgba(245,158,11,0.08)';
  ctx.strokeStyle = 'rgba(245,158,11,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 12);
  ctx.fill();
  ctx.stroke();

  ctx.font = '800 32px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#f59e0b';
  ctx.fillText(getTotalPoints(), w / 2 - 80, boxY + 50);
  ctx.font = '500 14px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#9090a8';
  ctx.fillText('Punkte', w / 2 - 80, boxY + 70);

  ctx.font = '600 24px Inter, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(245,158,11,0.3)';
  ctx.fillText('·', w / 2, boxY + 48);

  ctx.font = '800 32px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('13/13', w / 2 + 80, boxY + 50);
  ctx.font = '500 14px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#9090a8';
  ctx.fillText('Fragen richtig', w / 2 + 80, boxY + 70);

  // Achievement text
  ctx.font = '600 16px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#22c55e';
  ctx.fillText('🏔️  Innsbruck-Experte  🏔️', w / 2, 630);

  // Date
  const today = new Date().toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' });
  ctx.font = '400 15px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#9090a8';
  ctx.fillText(`Innsbruck, ${today}`, w / 2, 700);

  // Signatures
  const sigY = 820;
  // Left signature
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillStyle = '#e8e8f0';
  ctx.fillText('Dr. M. Hofer', w / 2 - 250, sigY);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 380, sigY + 15);
  ctx.lineTo(w / 2 - 120, sigY + 15);
  ctx.stroke();
  ctx.font = '400 12px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#9090a8';
  ctx.fillText('Klassenvorstand', w / 2 - 250, sigY + 40);

  // Right signature
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillStyle = '#e8e8f0';
  ctx.fillText('Mag. K. Brenner', w / 2 + 250, sigY);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(w / 2 + 120, sigY + 15);
  ctx.lineTo(w / 2 + 380, sigY + 15);
  ctx.stroke();
  ctx.font = '400 12px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#9090a8';
  ctx.fillText('Direktion', w / 2 + 250, sigY + 40);

  // Footer
  ctx.font = '400 11px Inter, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(144,144,168,0.5)';
  ctx.fillText('Innsbruck Erkunden · Interaktive Stadttour · Universität Innsbruck', w / 2, h - 70);

  // Download
  const link = document.createElement('a');
  link.download = `Innsbruck-Urkunde-${currentUser.username}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ===========================
// 15-Sekunden-Timer bei falscher Antwort
// ===========================

function startRetryTimer(chapter, seconds, onExpire) {
  const submitBtn  = document.getElementById('submitBtn');
  const submitHint = document.getElementById('submitHint');
  if (!submitBtn) return;
  submitBtn.disabled = true;
  submitBtn.dataset.timerActive = '1';
  document.getElementById('submitBtnText').textContent = `Nochmal versuchen (${seconds}s)`;

  let remaining = seconds;
  const timer = setInterval(() => {
    const btn = document.getElementById('submitBtn');
    if (!btn) { clearInterval(timer); return; }
    remaining--;
    if (remaining > 0) {
      document.getElementById('submitBtnText').textContent = `Nochmal versuchen (${remaining}s)`;
    } else {
      clearInterval(timer);
      delete btn.dataset.timerActive;
      if (onExpire) {
        onExpire();
      } else {
        const hint = document.getElementById('submitHint');
        if (hint) hint.textContent = 'Versuche es nochmal!';
        renderTaskUI(chapter.task, true);
        addSkipButton(chapter);
      }
    }
  }, 1000);
}

// ===========================
// Fortschritt zurücksetzen
// ===========================

async function resetProgress() {
  if (!confirm('Möchtest du wirklich den gesamten Fortschritt zurücksetzen? Das Video startet von vorne.')) return;

  try {
    await fetch(`${BACKEND_URL}/api/progress/reset`, {
      method: 'DELETE', headers: authHeaders()
    });
  } catch (_) {}

  progressMap      = {};
  attemptsMap      = {};
  botInteractions  = {};
  deferredChapters = [];
  nextChapterIndex = 0;
  questionActive   = false;
  stopPolling();
  updateProgressUI();

  // Video-Overlay verstecken
  const vqo = document.getElementById('videoQuestionOverlay');
  if (vqo) vqo.style.display = 'none';

  // Panels zurücksetzen
  document.getElementById('panelQuestion').classList.add('hidden');
  document.getElementById('panelCompleted').classList.add('hidden');
  const waiting = document.getElementById('panelWaiting');
  waiting.classList.remove('hidden');
  waiting.innerHTML = `
    <div class="waiting-icon">⏸</div>
    <p class="waiting-text">Das Video pausiert automatisch bei jeder Station und zeigt dir hier eine Aufgabe.</p>
  `;

  if (ytPlayer) {
    // Bestehenden Player von vorne starten
    ytPlayer.seekTo(0);
    ytPlayer.playVideo();
    startPolling();
  } else {
    document.getElementById('videoStartOverlay').style.display = 'flex';
  }

  showToast('Fortschritt zurückgesetzt! Das Video startet von vorne.', 'info');
}

function showFeedback(correct, text) {
  const box = document.getElementById('feedbackBox');
  const hdr = document.getElementById('feedbackHeader');
  const bdy = document.getElementById('feedbackText');
  if (!box) return;
  box.className = `feedback-box ${correct ? 'correct' : 'incorrect'} visible`;
  hdr.className = `feedback-header ${correct ? 'correct' : 'incorrect'}`;
  hdr.textContent = correct ? '✅ Richtig!' : '😊 Fast! Versuche es nochmal…';
  const bodyText = String(text || '').replace(/^[✅❌]\s*/,'');
  bdy.textContent = bodyText;
  bdy.style.display = bodyText ? '' : 'none';
}

// ===========================
// DOMContentLoaded
// ===========================

// ===========================
// Onboarding
// ===========================

function initOnboarding() {
  const onboarding = document.getElementById('onboarding');
  const app = document.getElementById('app');
  const check = document.getElementById('obAcceptCheck');
  const btn = document.getElementById('obStartBtn');

  if (sessionStorage.getItem('ibk_onboarding_done')) {
    onboarding.style.display = 'none';
    app.style.display = '';
    return;
  }

  check.addEventListener('change', () => {
    btn.disabled = !check.checked;
  });

  btn.addEventListener('click', () => {
    sessionStorage.setItem('ibk_onboarding_done', '1');
    onboarding.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    onboarding.style.opacity = '0';
    onboarding.style.transform = 'translateY(-40px)';
    setTimeout(() => {
      onboarding.style.display = 'none';
      app.style.display = '';
      app.style.opacity = '0';
      app.style.transform = 'translateY(30px)';
      requestAnimationFrame(() => {
        app.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        app.style.opacity = '1';
        app.style.transform = 'none';
      });
    }, 500);
  });
}

// ===========================
// Avatar System (DiceBear)
// ===========================

const AVATAR_STYLES = ['adventurer','adventurer-neutral','avataaars','bottts','fun-emoji','lorelei','notionists','open-peeps','pixel-art','thumbs'];

function getAvatarUrl(style) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${currentUser.username}`;
}

function loadUserAvatar() {
  const style = localStorage.getItem('ibk_avatar');
  const avatarEl = document.getElementById('userAvatar');
  if (style && AVATAR_STYLES.includes(style)) {
    avatarEl.innerHTML = `<img src="${getAvatarUrl(style)}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
  } else {
    avatarEl.textContent = currentUser.username.charAt(0).toUpperCase();
  }
}

function initAvatarPicker() {
  const modal = document.getElementById('avatarModal');
  const closeBtn = document.getElementById('avatarClose');
  const prevBtn = document.getElementById('avatarPrev');
  const nextBtn = document.getElementById('avatarNext');
  const saveBtn = document.getElementById('avatarSaveBtn');
  const previewImg = document.getElementById('avatarPreviewImg');
  const styleLabel = document.getElementById('avatarStyleLabel');
  const badge = document.getElementById('userBadge');

  let currentIdx = Math.max(0, AVATAR_STYLES.indexOf(localStorage.getItem('ibk_avatar') || ''));

  function updatePreview() {
    previewImg.src = getAvatarUrl(AVATAR_STYLES[currentIdx]);
    styleLabel.textContent = AVATAR_STYLES[currentIdx];
  }

  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    currentIdx = Math.max(0, AVATAR_STYLES.indexOf(localStorage.getItem('ibk_avatar') || ''));
    modal.classList.add('open');
    updatePreview();
  });

  closeBtn.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

  prevBtn.addEventListener('click', () => { currentIdx = (currentIdx - 1 + AVATAR_STYLES.length) % AVATAR_STYLES.length; updatePreview(); });
  nextBtn.addEventListener('click', () => { currentIdx = (currentIdx + 1) % AVATAR_STYLES.length; updatePreview(); });

  saveBtn.addEventListener('click', () => {
    localStorage.setItem('ibk_avatar', AVATAR_STYLES[currentIdx]);
    loadUserAvatar();
    modal.classList.remove('open');
    showToast('Avatar gespeichert!', 'success');
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initOnboarding();
  // User-Info
  document.getElementById('userNameDisplay').textContent = currentUser.username;
  loadUserAvatar();
  initAvatarPicker();
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

  // Reset
  document.getElementById('resetBtn').addEventListener('click', resetProgress);
  document.getElementById('completionResetBtn').addEventListener('click', () => {
    document.getElementById('completionScreen').classList.remove('visible');
    resetProgress();
  });
  document.getElementById('completionClose').addEventListener('click', () => {
    document.getElementById('completionScreen').classList.remove('visible');
  });

  // Urkunde
  document.getElementById('downloadCertBtn').addEventListener('click', downloadCertificate);

  // Scoreboard
  document.getElementById('scoreboardBtn').addEventListener('click', openScoreboard);
  document.getElementById('scoreboardClose').addEventListener('click', () => {
    document.getElementById('scoreboardModal').classList.remove('open');
  });

  // Privacy-Toggle laden & Change-Handler
  loadPrivacySetting();
  document.getElementById('privacyToggle').addEventListener('change', e => togglePrivacy(e.target.checked));

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

  if (fab) fab.addEventListener('click',           () => isOpen ? close() : open());
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

    if (questionActive) {
      const chapter = LESSON.chapters[nextChapterIndex];
      if (chapter) {
        botInteractions[chapter.id] = true;
        updateSkipButton(chapter);
      }
    }

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

// ===========================
// Scoreboard
// ===========================

async function openScoreboard() {
  const modal = document.getElementById('scoreboardModal');
  const body  = document.getElementById('scoreboardBody');
  modal.classList.add('open');
  body.innerHTML = '<div class="sb-loading">Lade Bestenliste…</div>';

  try {
    const res  = await fetch(`${BACKEND_URL}/api/scoreboard`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    if (!data.scoreboard.length) {
      body.innerHTML = '<div class="sb-empty">Noch keine Einträge 🏁</div>';
      return;
    }

    const medals = ['🥇','🥈','🥉'];
    body.innerHTML = data.scoreboard.map(r => `
      <div class="sb-row ${r.isMe ? 'sb-me' : ''}">
        <span class="sb-rank">${medals[r.rank-1] || r.rank}</span>
        <span class="sb-name">${r.username}${r.isMe ? ' (du)' : ''}</span>
        <span class="sb-pts">⭐ ${r.points} Pkt.</span>
        <span class="sb-done">${r.answered}/${LESSON.chapters.length} ✓</span>
      </div>
    `).join('');
  } catch (err) {
    body.innerHTML = `<div class="sb-empty">Fehler: ${err.message}</div>`;
  }
}

// ===========================
// Privacy-Einstellung
// ===========================

async function loadPrivacySetting() {
  try {
    const res  = await fetch(`${BACKEND_URL}/api/scoreboard/me`, { headers: authHeaders() });
    const data = await res.json();
    const toggle = document.getElementById('privacyToggle');
    if (toggle) toggle.checked = data.show_on_scoreboard !== false;
  } catch (_) {}
}

async function togglePrivacy(show) {
  try {
    await fetch(`${BACKEND_URL}/api/scoreboard/privacy`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ show })
    });
    showToast(show ? '👁 Du bist jetzt auf dem Scoreboard sichtbar' : '🔒 Du bist jetzt anonym', 'info');
  } catch (_) {}
}
