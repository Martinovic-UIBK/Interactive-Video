// ============================================================
// app.js – Innsbruck Lernplattform
// ============================================================

const BACKEND_URL = (() => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  return 'https://interactive-video-backend.onrender.com';
})();

// ===========================
// Auth-Check
// ===========================
const token   = localStorage.getItem('ibk_token');
const userRaw = localStorage.getItem('ibk_user');

if (!token || !userRaw) {
  window.location.href = 'login.html';
  throw new Error('Not authenticated');
}

const currentUser = JSON.parse(userRaw);

// ===========================
// State
// ===========================
let progressMap    = {};
let ytApiReady     = false;
let ytPlayer       = null;
let currentStation = null;
let videoWatched   = false;
let sortOrder      = [];

window.onYouTubeIframeAPIReady = () => { ytApiReady = true; };

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

function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fadeout');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

function getCompletedCount() {
  return STATIONS.filter(s => progressMap[s.id]?.is_correct).length;
}

function isStationUnlocked(stationId) {
  if (stationId === 1) return true;
  const prev = progressMap[stationId - 1];
  return prev && prev.video_watched && prev.is_correct;
}

function isStationCompleted(stationId) {
  return !!progressMap[stationId]?.is_correct;
}

function updateProgressUI() {
  const done = getCompletedCount();
  document.getElementById('progressCount').textContent = `${done} / ${STATIONS.length}`;
  document.getElementById('progressBar').style.width   = `${Math.round((done / STATIONS.length) * 100)}%`;
}

// ===========================
// Fortschritt laden
// ===========================

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

// ===========================
// Karten rendern
// ===========================

function renderStations() {
  const grid = document.getElementById('stationsGrid');
  grid.innerHTML = '';

  STATIONS.forEach(station => {
    const unlocked  = isStationUnlocked(station.id);
    const completed = isStationCompleted(station.id);
    const taskType  = station.task?.type || 'open';

    const typeLabels = { single: 'Einfachauswahl', multiple: 'Mehrfachauswahl', open: 'Offene Frage', sort: 'Sortieraufgabe' };
    const typeIcons  = { single: '🔘', multiple: '☑️', open: '✏️', sort: '↕️' };

    const card = document.createElement('div');
    card.className = `station-card ${completed ? 'completed' : unlocked ? 'unlocked' : 'locked'}`;
    card.dataset.id = station.id;

    let statusText = '🔒 Gesperrt';
    let dotClass   = 'locked';
    if (completed) { statusText = '✅ Abgeschlossen'; dotClass = 'completed'; }
    else if (unlocked) { statusText = '▶️ Jetzt starten'; dotClass = 'unlocked'; }

    card.innerHTML = `
      <div class="station-card-header">
        <div class="station-icon-wrapper">${station.icon}</div>
        <span class="station-number">#${station.id}</span>
      </div>
      <div class="station-title">${station.title}</div>
      <div class="station-subtitle">${station.subtitle}</div>
      <div class="station-location">📍 ${station.location}</div>
      <div class="task-type-badge">
        <span>${typeIcons[taskType]}</span> ${typeLabels[taskType]}
      </div>
      <div class="station-status">
        <span class="status-dot ${dotClass}"></span>
        <span class="status-text ${dotClass}">${statusText}</span>
      </div>
    `;

    if (unlocked || completed) card.addEventListener('click', () => openModal(station));
    grid.appendChild(card);
  });

  updateProgressUI();
}

// ===========================
// Modal öffnen
// ===========================

function openModal(station) {
  currentStation = station;
  videoWatched   = false;
  sortOrder      = [];

  document.getElementById('modalIcon').textContent     = station.icon;
  document.getElementById('modalTitle').textContent    = station.title;
  document.getElementById('modalSubtitle').textContent = station.subtitle;
  document.getElementById('modalLocation').textContent = '📍 ' + station.location;

  const typeLabels = { single: '🔘 Einfachauswahl', multiple: '☑️ Mehrfachauswahl', open: '✏️ Offene Frage', sort: '↕️ Sortieraufgabe' };
  document.getElementById('questionTypeLabel').textContent = typeLabels[station.task?.type] || '✏️ Aufgabe';
  document.getElementById('questionText').textContent      = station.task?.question || '';

  const completed = isStationCompleted(station.id);
  const progress  = progressMap[station.id];

  const hint = document.getElementById('videoHint');
  if (completed) {
    hint.textContent = '✅ Video bereits angesehen.';
    hint.className   = 'video-hint video-done';
  } else {
    hint.textContent = '⏳ Schau das Video vollständig an, um die Aufgabe zu aktivieren.';
    hint.className   = 'video-hint';
    if (progress?.video_watched) videoWatched = true;
  }

  renderTaskUI(station, completed, progress);

  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => initYTPlayer(station.youtubeId), 100);
}

// ===========================
// Aufgaben-UI rendern
// ===========================

function renderTaskUI(station, completed, progress) {
  const container = document.getElementById('taskContainer');
  container.innerHTML = '';

  // Abgeschlossene Station: Read-only Ansicht
  if (completed && progress) {
    container.innerHTML = `
      <div class="feedback-box correct visible">
        <div class="feedback-header correct">✅ Station abgeschlossen!</div>
        <div class="feedback-text">${progress.feedback || ''}</div>
      </div>
      ${progress.answer_text ? `
        <div class="completed-answer-box">
          <div class="completed-answer-label">Deine Antwort</div>
          <div class="completed-answer-text">${progress.answer_text}</div>
        </div>` : ''}
    `;
    return;
  }

  const task      = station.task;
  const isEnabled = videoWatched;

  if (task.type === 'open') {
    container.innerHTML = `
      <textarea class="answer-textarea" id="answerInput"
        placeholder="Schreibe hier deine Antwort…" rows="4"
        ${isEnabled ? '' : 'disabled'}></textarea>
      <div class="submit-row">
        <button class="btn-submit" id="submitBtn" disabled>
          <span id="submitBtnText">Antwort senden</span>
        </button>
        <span class="submit-hint" id="submitHint">${isEnabled ? 'Mindestens 1 Wort eingeben' : 'Zuerst Video fertig schauen'}</span>
      </div>
      <div class="feedback-box" id="feedbackBox">
        <div class="feedback-header" id="feedbackHeader"></div>
        <div class="feedback-text"  id="feedbackText"></div>
      </div>
    `;
    if (isEnabled) {
      const ta = document.getElementById('answerInput');
      ta.addEventListener('input', () => {
        document.getElementById('submitBtn').disabled = ta.value.trim().length === 0;
      });
      ta.focus();
    }
    document.getElementById('submitBtn').addEventListener('click', submitTask);
    document.getElementById('answerInput').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitTask(); }
    });

  } else if (task.type === 'single' || task.type === 'multiple') {
    const isMultiple = task.type === 'multiple';
    const opts = task.options.map((opt, i) => `
      <label class="choice-option ${isMultiple ? 'choice-checkbox' : ''} ${isEnabled ? '' : 'choice-disabled'}" data-index="${i}">
        <span class="${isMultiple ? 'choice-check' : 'choice-radio'}"></span>
        <span class="choice-text">${opt}</span>
      </label>
    `).join('');

    container.innerHTML = `
      <div class="choice-list" id="choiceList">${opts}</div>
      <div class="submit-row">
        <button class="btn-submit" id="submitBtn" disabled>
          <span id="submitBtnText">Überprüfen</span>
        </button>
        <span class="submit-hint" id="submitHint">${isEnabled ? (isMultiple ? 'Wähle alle richtigen Antworten' : 'Wähle eine Antwort') : 'Zuerst Video fertig schauen'}</span>
      </div>
      <div class="feedback-box" id="feedbackBox">
        <div class="feedback-header" id="feedbackHeader"></div>
        <div class="feedback-text"  id="feedbackText"></div>
      </div>
    `;
    if (isEnabled) {
      document.querySelectorAll('.choice-option').forEach(el => {
        el.addEventListener('click', () => {
          if (!isMultiple) document.querySelectorAll('.choice-option').forEach(o => o.classList.remove('selected'));
          el.classList.toggle('selected');
          const any = document.querySelectorAll('.choice-option.selected').length > 0;
          document.getElementById('submitBtn').disabled = !any;
          if (any) document.getElementById('submitHint').textContent = '';
        });
      });
    }
    document.getElementById('submitBtn').addEventListener('click', submitTask);

  } else if (task.type === 'sort') {
    // Startreihenfolge: um eine Position rotiert (immer anders als Lösung)
    sortOrder = task.items.map((_, i) => i);
    sortOrder = [...sortOrder.slice(1), sortOrder[0]];

    container.innerHTML = `
      <div class="sort-list" id="sortList"></div>
      <div class="submit-row" style="margin-top:14px">
        <button class="btn-submit" id="submitBtn" ${isEnabled ? '' : 'disabled'}>
          <span id="submitBtnText">Reihenfolge prüfen</span>
        </button>
        <span class="submit-hint" id="submitHint">${isEnabled ? 'Verschiebe die Items mit ▲ ▼' : 'Zuerst Video fertig schauen'}</span>
      </div>
      <div class="feedback-box" id="feedbackBox">
        <div class="feedback-header" id="feedbackHeader"></div>
        <div class="feedback-text"  id="feedbackText"></div>
      </div>
    `;
    renderSortList(task, isEnabled);
    document.getElementById('submitBtn').addEventListener('click', submitTask);
  }
}

function renderSortList(task, isEnabled) {
  const list = document.getElementById('sortList');
  if (!list) return;
  list.innerHTML = sortOrder.map((origIdx, pos) => `
    <div class="sort-item ${isEnabled ? '' : 'sort-disabled'}" data-pos="${pos}">
      <div class="sort-handle">
        <button class="sort-btn" data-dir="up"   data-pos="${pos}" ${pos === 0 ? 'disabled' : ''}>▲</button>
        <button class="sort-btn" data-dir="down" data-pos="${pos}" ${pos === sortOrder.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
      <span class="sort-text">${task.items[origIdx]}</span>
    </div>
  `).join('');

  if (isEnabled) {
    list.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const pos = parseInt(btn.dataset.pos, 10);
        const dir = btn.dataset.dir;
        if (dir === 'up' && pos > 0)
          [sortOrder[pos], sortOrder[pos - 1]] = [sortOrder[pos - 1], sortOrder[pos]];
        else if (dir === 'down' && pos < sortOrder.length - 1)
          [sortOrder[pos], sortOrder[pos + 1]] = [sortOrder[pos + 1], sortOrder[pos]];
        renderSortList(currentStation.task, true);
      });
    });
  }
}

// ===========================
// Input nach Video aktivieren
// ===========================

function enableTaskInput() {
  if (!currentStation) return;
  const task = currentStation.task;

  if (task.type === 'open') {
    const ta = document.getElementById('answerInput');
    if (ta) {
      ta.disabled = false;
      ta.focus();
      ta.addEventListener('input', () => {
        document.getElementById('submitBtn').disabled = ta.value.trim().length === 0;
      });
    }
    document.getElementById('submitHint').textContent = 'Mindestens 1 Wort eingeben';

  } else if (task.type === 'single' || task.type === 'multiple') {
    const isMultiple = task.type === 'multiple';
    document.querySelectorAll('.choice-option').forEach(el => {
      el.classList.remove('choice-disabled');
      el.addEventListener('click', () => {
        if (!isMultiple) document.querySelectorAll('.choice-option').forEach(o => o.classList.remove('selected'));
        el.classList.toggle('selected');
        const any = document.querySelectorAll('.choice-option.selected').length > 0;
        document.getElementById('submitBtn').disabled = !any;
        if (any) document.getElementById('submitHint').textContent = '';
      });
    });
    document.getElementById('submitBtn').disabled = true;
    document.getElementById('submitHint').textContent = isMultiple ? 'Wähle alle richtigen Antworten' : 'Wähle eine Antwort';

  } else if (task.type === 'sort') {
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('submitHint').textContent = 'Verschiebe die Items mit ▲ ▼';
    renderSortList(task, true);
  }
}

// ===========================
// Aufgabe einreichen
// ===========================

async function submitTask() {
  if (!currentStation) return;
  const submitBtn = document.getElementById('submitBtn');
  if (!submitBtn || submitBtn.disabled) return;

  const task = currentStation.task;
  if (task.type === 'open') {
    await submitOpenQuestion();
  } else {
    submitClientSide(task);
  }
}

function submitClientSide(task) {
  const submitBtn   = document.getElementById('submitBtn');
  const submitHint  = document.getElementById('submitHint');
  let isCorrect = false;
  let answerText = '';

  if (task.type === 'single') {
    const selected = document.querySelector('.choice-option.selected');
    if (!selected) return;
    const idx = parseInt(selected.dataset.index, 10);
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
    const selected = [...document.querySelectorAll('.choice-option.selected')].map(el => parseInt(el.dataset.index, 10));
    isCorrect  = JSON.stringify([...selected].sort()) === JSON.stringify([...task.correct].sort());
    answerText = selected.map(i => task.options[i]).join(', ');
    document.querySelectorAll('.choice-option').forEach(el => {
      const i = parseInt(el.dataset.index, 10);
      if (task.correct.includes(i)) el.classList.add('correct-answer');
      else if (selected.includes(i)) el.classList.add('wrong-answer');
      el.style.pointerEvents = 'none';
    });

  } else if (task.type === 'sort') {
    const correctOrder = task.items.map((_, i) => i);
    isCorrect  = JSON.stringify(sortOrder) === JSON.stringify(correctOrder);
    answerText = sortOrder.map(i => task.items[i]).join(' → ');
    document.querySelectorAll('.sort-item').forEach((el, pos) => {
      el.classList.add(sortOrder[pos] === pos ? 'sort-correct' : 'sort-wrong');
    });
    document.querySelectorAll('.sort-btn').forEach(b => b.disabled = true);
  }

  showFeedback(isCorrect, isCorrect ? task.feedback : '❌ Noch nicht ganz richtig – schau dir die markierten Elemente an und versuche es nochmal!');

  if (isCorrect) {
    submitBtn.disabled = true;
    submitHint.textContent = 'Station abgeschlossen!';
    saveProgressClientSide(currentStation.id, answerText, task.feedback);
    unlockNext(currentStation.id);
  } else {
    submitBtn.textContent = 'Nochmal versuchen';
    if (task.type === 'sort') {
      setTimeout(() => renderTaskUI(currentStation, false, null), 1500);
    }
  }
}

function showFeedback(correct, text) {
  const box    = document.getElementById('feedbackBox');
  const header = document.getElementById('feedbackHeader');
  const body   = document.getElementById('feedbackText');
  if (!box) return;
  box.className    = `feedback-box ${correct ? 'correct' : 'incorrect'} visible`;
  header.className = `feedback-header ${correct ? 'correct' : 'incorrect'}`;
  header.textContent = correct ? '✅ Richtig!' : '❌ Noch nicht ganz…';
  body.textContent   = String(text).replace(/^[✅❌]\s*/, '');
}

async function submitOpenQuestion() {
  const textarea  = document.getElementById('answerInput');
  const answerTxt = textarea?.value.trim();
  if (!answerTxt) { showToast('Bitte schreibe zuerst deine Antwort.', 'error'); return; }

  const submitBtn  = document.getElementById('submitBtn');
  const submitHint = document.getElementById('submitHint');

  submitBtn.disabled    = true;
  textarea.disabled     = true;
  submitHint.textContent = 'Gemini AI bewertet…';
  document.getElementById('feedbackBox').className = 'feedback-box';

  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  submitBtn.prepend(spinner);
  document.getElementById('submitBtnText').textContent = 'KI bewertet…';

  try {
    const res = await fetch(`${BACKEND_URL}/api/evaluate`, {
      method:  'POST',
      headers: authHeaders(),
      body:    JSON.stringify({
        stationId: currentStation.id,
        question:  currentStation.task.question,
        keyInfo:   currentStation.task.keyInfo,
        answer:    answerTxt
      })
    });
    if (res.status === 401) { logout(); return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    spinner.remove();
    showFeedback(data.correct, data.feedback);

    if (data.correct) {
      submitBtn.disabled    = true;
      submitHint.textContent = 'Station abgeschlossen!';
      progressMap[currentStation.id] = {
        ...(progressMap[currentStation.id] || {}),
        station_number: currentStation.id,
        video_watched: true, answer_text: answerTxt, is_correct: true, feedback: data.feedback
      };
      renderStations();
      unlockNext(currentStation.id);
    } else {
      submitBtn.disabled    = false;
      textarea.disabled     = false;
      document.getElementById('submitBtnText').textContent = 'Nochmal versuchen';
      submitHint.textContent = 'Schreibe eine neue Antwort!';
    }
  } catch (err) {
    spinner.remove();
    showFeedback(false, `Fehler: ${err.message}`);
    submitBtn.disabled    = false;
    textarea.disabled     = false;
    document.getElementById('submitBtnText').textContent = 'Nochmal senden';
  }
}

async function saveProgressClientSide(stationId, answerText, feedback) {
  try {
    await fetch(`${BACKEND_URL}/api/progress/complete/${stationId}`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ answerText, feedback })
    });
    progressMap[stationId] = {
      ...(progressMap[stationId] || {}),
      station_number: stationId, video_watched: true,
      answer_text: answerText, is_correct: true, feedback
    };
    renderStations();
  } catch (_) {}
}

function unlockNext(stationId) {
  const nextId = stationId + 1;
  if (nextId <= STATIONS.length) {
    setTimeout(() => {
      document.querySelector(`.station-card[data-id="${nextId}"]`)?.classList.add('just-unlocked');
    }, 300);
    showToast(`🎉 Station ${nextId} ist jetzt freigeschaltet!`, 'success');
  } else {
    showToast('🏆 Alle 12 Stationen abgeschlossen! Herzlichen Glückwunsch!', 'success', 7000);
  }
}

async function markVideoWatched(stationNumber) {
  try {
    await fetch(`${BACKEND_URL}/api/progress/video-watched/${stationNumber}`, {
      method: 'POST', headers: authHeaders()
    });
    if (!progressMap[stationNumber]) progressMap[stationNumber] = {};
    progressMap[stationNumber].video_watched = true;
  } catch (_) {}
}

// ===========================
// Modal schließen
// ===========================

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
  if (ytPlayer) {
    try { ytPlayer.stopVideo(); } catch (_) {}
    try { ytPlayer.destroy();   } catch (_) {}
    ytPlayer = null;
  }
  document.getElementById('yt-player').innerHTML = '';
  currentStation = null;
}

// ===========================
// YouTube Player
// ===========================

function initYTPlayer(videoId) {
  if (ytPlayer) { try { ytPlayer.destroy(); } catch (_) {} ytPlayer = null; }
  document.getElementById('yt-player').innerHTML = '';
  const tryInit = () => {
    if (!ytApiReady || typeof YT === 'undefined' || !YT.Player) { setTimeout(tryInit, 200); return; }
    ytPlayer = new YT.Player('yt-player', {
      videoId,
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
      events: { onStateChange: onPlayerStateChange, onError: onPlayerError }
    });
  };
  tryInit();
}

function onPlayerStateChange(event) {
  if (event.data === 0) {
    videoWatched = true;
    markVideoWatched(currentStation?.id);
    const hint = document.getElementById('videoHint');
    hint.textContent = '✅ Video abgeschlossen! Du kannst jetzt die Aufgabe lösen.';
    hint.className   = 'video-hint video-done';
    enableTaskInput();
  }
}

function onPlayerError() {
  document.getElementById('videoHint').textContent = '⚠️ Video konnte nicht geladen werden. Bitte YouTube-ID prüfen.';
}

// ===========================
// DOMContentLoaded
// ===========================

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('userNameDisplay').textContent = currentUser.username;
  document.getElementById('userAvatar').textContent = currentUser.username.charAt(0).toUpperCase();
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  await loadProgress();
  renderStations();
});

// ===========================
// Chatbot
// ===========================

document.addEventListener('DOMContentLoaded', () => { initChatbot(); });

function initChatbot() {
  const fab        = document.getElementById('chatFab');
  const heroBtn    = document.getElementById('chatHeroBtn');
  const chatWindow = document.getElementById('chatWindow');
  const closeBtn   = document.getElementById('chatClose');
  const input      = document.getElementById('chatInput');
  const sendBtn    = document.getElementById('chatSend');
  const messages   = document.getElementById('chatMessages');
  let isOpen = false;

  const openChat  = () => { isOpen = true;  chatWindow.classList.add('open');    chatWindow.setAttribute('aria-hidden','false'); input.focus(); };
  const closeChat = () => { isOpen = false; chatWindow.classList.remove('open'); chatWindow.setAttribute('aria-hidden','true'); };

  fab.addEventListener('click',                  () => isOpen ? closeChat() : openChat());
  if (heroBtn) heroBtn.addEventListener('click', () => isOpen ? closeChat() : openChat());
  closeBtn.addEventListener('click', closeChat);
  sendBtn.addEventListener('click', sendChatMessage);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChatMessage(); } });

  function appendBubble(text, type) {
    const b = document.createElement('div');
    b.className = `chat-bubble chat-bubble-${type}`;
    b.innerHTML = text;
    messages.appendChild(b);
    messages.scrollTop = messages.scrollHeight;
  }

  function showTyping() {
    const t = document.createElement('div');
    t.className = 'chat-typing'; t.id = 'chatTyping';
    t.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(t);
    messages.scrollTop = messages.scrollHeight;
  }

  async function sendChatMessage() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendBtn.disabled = true;
    input.disabled   = true;
    appendBubble(text, 'user');
    showTyping();
    try {
      const res  = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ message: text })
      });
      document.getElementById('chatTyping')?.remove();
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Fehler');
      appendBubble(data.reply, 'bot');
    } catch (err) {
      document.getElementById('chatTyping')?.remove();
      appendBubble(`⚠️ ${err.message}`, 'error');
    } finally {
      sendBtn.disabled = false;
      input.disabled   = false;
      input.focus();
    }
  }
}
