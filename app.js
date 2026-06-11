// ============================================================
// app.js – Innsbruck Lernplattform (Hauptlogik)
// ============================================================

// ------ KONFIGURATION ------
// WICHTIG: Ersetze die Render-URL nach dem Backend-Deployment!
const BACKEND_URL = (() => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  return 'https://interactive-video-backend.onrender.com';
})();

// ===========================
// Auth-Check
// ===========================
const token = localStorage.getItem('ibk_token');
const userRaw = localStorage.getItem('ibk_user');

if (!token || !userRaw) {
  window.location.href = 'login.html';
  throw new Error('Not authenticated');
}

const currentUser = JSON.parse(userRaw);

// ===========================
// State
// ===========================
let progressMap = {};     // { stationNumber: progressRow }
let ytApiReady  = false;
let ytPlayer    = null;
let currentStation = null;  // Station-Objekt des offenen Modals
let videoWatched  = false;

// ===========================
// YouTube IFrame API Callback
// ===========================
window.onYouTubeIframeAPIReady = () => {
  ytApiReady = true;
};

// ===========================
// Hilfsfunktionen
// ===========================

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
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

// ===========================
// Fortschritt berechnen
// ===========================

function getCompletedCount() {
  return STATIONS.filter(s => {
    const p = progressMap[s.id];
    return p && p.is_correct;
  }).length;
}

function isStationUnlocked(stationId) {
  if (stationId === 1) return true;
  const prev = progressMap[stationId - 1];
  return prev && prev.video_watched && prev.is_correct;
}

function isStationCompleted(stationId) {
  const p = progressMap[stationId];
  return p && p.is_correct;
}

// ===========================
// Fortschrittsbalken
// ===========================

function updateProgressUI() {
  const done = getCompletedCount();
  const pct  = Math.round((done / STATIONS.length) * 100);
  document.getElementById('progressCount').textContent = `${done} / ${STATIONS.length}`;
  document.getElementById('progressBar').style.width   = `${pct}%`;
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

    const card = document.createElement('div');
    card.className = `station-card ${completed ? 'completed' : unlocked ? 'unlocked' : 'locked'}`;
    card.dataset.id = station.id;

    let statusDotClass = 'locked';
    let statusText     = '🔒 Gesperrt';
    if (completed) { statusDotClass = 'completed'; statusText = '✅ Abgeschlossen'; }
    else if (unlocked) { statusDotClass = 'unlocked'; statusText = '▶️ Jetzt starten'; }

    card.innerHTML = `
      <div class="station-card-header">
        <div class="station-icon-wrapper">${station.icon}</div>
        <span class="station-number">#${station.id}</span>
      </div>
      <div class="station-title">${station.title}</div>
      <div class="station-subtitle">${station.subtitle}</div>
      <div class="station-location">📍 ${station.location}</div>
      <div class="station-status">
        <span class="status-dot ${statusDotClass}"></span>
        <span class="status-text ${statusDotClass}">${statusText}</span>
      </div>
    `;

    if (unlocked || completed) {
      card.addEventListener('click', () => openModal(station));
    }

    grid.appendChild(card);
  });

  updateProgressUI();
}

// ===========================
// Fortschritt vom Backend laden
// ===========================

async function loadProgress() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/progress`, {
      headers: authHeaders()
    });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) throw new Error('Fortschritt konnte nicht geladen werden.');

    const data = await res.json();
    progressMap = {};
    data.progress.forEach(row => {
      progressMap[row.station_number] = row;
    });
  } catch (err) {
    console.error('loadProgress:', err);
    showToast('Fortschritt konnte nicht geladen werden.', 'error');
  }
}

// ===========================
// Modal öffnen
// ===========================

function openModal(station) {
  currentStation = station;
  videoWatched   = false;

  // Felder befüllen
  document.getElementById('modalIcon').textContent     = station.icon;
  document.getElementById('modalTitle').textContent    = station.title;
  document.getElementById('modalSubtitle').textContent = station.subtitle;
  document.getElementById('modalLocation').textContent = '📍 ' + station.location;
  document.getElementById('questionText').textContent  = station.question;

  const completed = isStationCompleted(station.id);
  const progress  = progressMap[station.id];

  if (completed && progress) {
    // Read-only Ansicht
    document.getElementById('answerSection').classList.add('hidden');
    document.getElementById('completedSection').classList.remove('hidden');
    document.getElementById('completedFeedback').textContent = progress.feedback || '';
    document.getElementById('completedAnswer').textContent   = progress.answer_text || '';

    // Video-Hint anzeigen
    const hint = document.getElementById('videoHint');
    hint.textContent = '✅ Video bereits angesehen.';
    hint.className = 'video-hint video-done';
  } else {
    // Aktive Antwort-Ansicht
    document.getElementById('answerSection').classList.remove('hidden');
    document.getElementById('completedSection').classList.add('hidden');

    // Textarea & Button zurücksetzen
    const textarea = document.getElementById('answerInput');
    textarea.value    = '';
    textarea.disabled = true;

    const submitBtn  = document.getElementById('submitBtn');
    const submitHint = document.getElementById('submitHint');
    submitBtn.disabled = true;
    document.getElementById('submitBtnText').textContent = 'Antwort senden';
    submitHint.textContent = 'Zuerst Video fertig schauen';

    // Feedback verstecken
    const feedbackBox = document.getElementById('feedbackBox');
    feedbackBox.className = 'feedback-box';

    // Video bereits geschaut?
    if (progress && progress.video_watched) {
      videoWatched = true;
      enableAnswerInput();
    }

    const hint = document.getElementById('videoHint');
    hint.textContent = '⏳ Schau das Video vollständig an, um die Frage zu aktivieren.';
    hint.className = 'video-hint';
  }

  // Modal anzeigen
  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  // YouTube Player initialisieren (kurze Verzögerung, damit DOM bereit ist)
  setTimeout(() => initYTPlayer(station.youtubeId), 100);
}

// ===========================
// Modal schließen
// ===========================

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';

  // YouTube Player stoppen & zerstören
  if (ytPlayer) {
    try { ytPlayer.stopVideo(); } catch (_) {}
    try { ytPlayer.destroy();   } catch (_) {}
    ytPlayer = null;
  }

  // Player-Div zurücksetzen
  const container = document.getElementById('yt-player');
  container.innerHTML = '';

  currentStation = null;
}

// ===========================
// YouTube Player initialisieren
// ===========================

function initYTPlayer(videoId) {
  if (ytPlayer) {
    try { ytPlayer.destroy(); } catch (_) {}
    ytPlayer = null;
    document.getElementById('yt-player').innerHTML = '';
  }

  const tryInit = () => {
    if (!ytApiReady || typeof YT === 'undefined' || !YT.Player) {
      setTimeout(tryInit, 200);
      return;
    }

    ytPlayer = new YT.Player('yt-player', {
      videoId: videoId,
      playerVars: {
        rel:      0,
        modestbranding: 1,
        playsinline: 1
      },
      events: {
        onStateChange: onPlayerStateChange,
        onError:       onPlayerError
      }
    });
  };

  tryInit();
}

function onPlayerStateChange(event) {
  // YT.PlayerState.ENDED === 0
  if (event.data === 0) {
    onVideoEnded();
  }
}

function onPlayerError(event) {
  console.warn('YouTube Player Fehler, Code:', event.data);
  const hint = document.getElementById('videoHint');
  hint.textContent = '⚠️ Video konnte nicht geladen werden. Bitte YouTube-ID prüfen.';
}

function onVideoEnded() {
  if (!currentStation) return;
  videoWatched = true;

  // Im Backend speichern (fire & forget)
  markVideoWatched(currentStation.id);

  // Hint aktualisieren
  const hint = document.getElementById('videoHint');
  hint.textContent = '✅ Video abgeschlossen! Du kannst jetzt die Frage beantworten.';
  hint.className = 'video-hint video-done';

  enableAnswerInput();
}

function enableAnswerInput() {
  const textarea   = document.getElementById('answerInput');
  const submitBtn  = document.getElementById('submitBtn');
  const submitHint = document.getElementById('submitHint');

  textarea.disabled   = false;
  submitBtn.disabled  = false;
  submitHint.textContent = 'Mindestens 1 Wort eingeben';
  textarea.focus();
}

// ===========================
// Video-gesehen im Backend speichern
// ===========================

async function markVideoWatched(stationNumber) {
  try {
    await fetch(`${BACKEND_URL}/api/progress/video-watched/${stationNumber}`, {
      method: 'POST',
      headers: authHeaders()
    });
    // Lokalen State aktualisieren
    if (!progressMap[stationNumber]) progressMap[stationNumber] = {};
    progressMap[stationNumber].video_watched = true;
  } catch (err) {
    console.warn('markVideoWatched Fehler:', err);
  }
}

// ===========================
// Antwort einreichen
// ===========================

async function submitAnswer() {
  if (!currentStation) return;

  const textarea  = document.getElementById('answerInput');
  const answerTxt = textarea.value.trim();

  if (!answerTxt) {
    showToast('Bitte schreibe zuerst deine Antwort.', 'error');
    return;
  }

  const submitBtn  = document.getElementById('submitBtn');
  const submitHint = document.getElementById('submitHint');
  const feedbackBox = document.getElementById('feedbackBox');

  // Loading state
  submitBtn.disabled = true;
  document.getElementById('submitBtnText').textContent = 'KI bewertet…';
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  submitBtn.prepend(spinner);
  textarea.disabled = true;
  feedbackBox.className = 'feedback-box';
  submitHint.textContent = 'Gemini AI denkt nach…';

  try {
    const res = await fetch(`${BACKEND_URL}/api/evaluate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        stationId:  currentStation.id,
        question:   currentStation.question,
        keyInfo:    currentStation.keyInfo,
        answer:     answerTxt
      })
    });

    if (res.status === 401) { logout(); return; }

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Bewertung fehlgeschlagen.');

    // Feedback anzeigen
    const header = document.getElementById('feedbackHeader');
    const text   = document.getElementById('feedbackText');

    if (data.correct) {
      feedbackBox.className = 'feedback-box correct visible';
      header.className = 'feedback-header correct';
      header.textContent = '✅ Richtig! Gut gemacht!';
      text.textContent = data.feedback;

      // Lokalen Progress aktualisieren
      progressMap[currentStation.id] = {
        ...(progressMap[currentStation.id] || {}),
        station_number: currentStation.id,
        video_watched:  true,
        answer_text:    answerTxt,
        is_correct:     true,
        feedback:       data.feedback
      };

      // Nächste Station entsperren (Animation)
      renderStations();

      const nextId = currentStation.id + 1;
      if (nextId <= STATIONS.length) {
        setTimeout(() => {
          const nextCard = document.querySelector(`.station-card[data-id="${nextId}"]`);
          if (nextCard) nextCard.classList.add('just-unlocked');
        }, 300);
        showToast(`🎉 Station ${nextId} ist jetzt freigeschaltet!`, 'success');
      } else {
        showToast('🏆 Du hast alle 12 Stationen abgeschlossen! Herzlichen Glückwunsch!', 'success', 7000);
      }

      submitHint.textContent = 'Station abgeschlossen!';

    } else {
      feedbackBox.className = 'feedback-box incorrect visible';
      header.className = 'feedback-header incorrect';
      header.textContent = '❌ Noch nicht ganz richtig…';
      text.textContent = data.feedback;

      // Nochmal versuchen
      submitBtn.disabled = false;
      document.getElementById('submitBtnText').textContent = 'Nochmal versuchen';
      textarea.disabled = false;
      submitHint.textContent = 'Du kannst es nochmal versuchen!';
    }

    if (spinner.parentNode) spinner.parentNode.removeChild(spinner);

  } catch (err) {
    if (spinner.parentNode) spinner.parentNode.removeChild(spinner);
    feedbackBox.className = 'feedback-box incorrect visible';
    document.getElementById('feedbackHeader').className = 'feedback-header incorrect';
    document.getElementById('feedbackHeader').textContent = '⚠️ Fehler';
    document.getElementById('feedbackText').textContent = err.message;
    submitBtn.disabled = false;
    document.getElementById('submitBtnText').textContent = 'Nochmal senden';
    textarea.disabled = false;
    submitHint.textContent = '';
  }
}

// ===========================
// Event Listener
// ===========================

document.addEventListener('DOMContentLoaded', async () => {
  // User-Info in Header setzen
  document.getElementById('userNameDisplay').textContent = currentUser.username;
  document.getElementById('userAvatar').textContent =
    currentUser.username.charAt(0).toUpperCase();

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', logout);

  // Modal schließen
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Antwort abschicken
  document.getElementById('submitBtn').addEventListener('click', submitAnswer);

  // Enter im Textarea: Shift+Enter = Newline, sonst nichts (Submit nur per Button)
  document.getElementById('answerInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!document.getElementById('submitBtn').disabled) submitAnswer();
    }
  });

  // Fortschritt laden und Karten rendern
  await loadProgress();
  renderStations();
});

// ===========================
// Chatbot – sofort beim Laden initialisieren (unabhängig von async)
// ===========================

// Direkt beim DOMContentLoaded, NICHT erst nach loadProgress
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

  function openChat() {
    isOpen = true;
    chatWindow.classList.add('open');
    chatWindow.setAttribute('aria-hidden', 'false');
    fab.setAttribute('aria-label', 'KI-Assistent schließen');
    input.focus();
  }

  function closeChat() {
    isOpen = false;
    chatWindow.classList.remove('open');
    chatWindow.setAttribute('aria-hidden', 'true');
    fab.setAttribute('aria-label', 'KI-Assistent öffnen');
  }

  fab.addEventListener('click',     () => isOpen ? closeChat() : openChat());
  if (heroBtn) heroBtn.addEventListener('click', () => isOpen ? closeChat() : openChat());
  closeBtn.addEventListener('click', closeChat);

  // Nachricht schicken per Button oder Enter
  sendBtn.addEventListener('click', sendChatMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendChatMessage(); }
  });

  function appendBubble(text, type) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble-${type}`;
    bubble.innerHTML = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  function showTyping() {
    const typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.id = 'chatTyping';
    typing.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
  }

  function removeTyping() {
    const t = document.getElementById('chatTyping');
    if (t) t.remove();
  }

  async function sendChatMessage() {
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    sendBtn.disabled = true;
    input.disabled   = true;

    // User-Bubble
    appendBubble(text, 'user');
    showTyping();

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify({ message: text })
      });

      removeTyping();

      if (res.status === 401) { logout(); return; }

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Fehler beim Senden.');

      appendBubble(data.reply, 'bot');

    } catch (err) {
      removeTyping();
      appendBubble(`⚠️ ${err.message}`, 'error');
    } finally {
      sendBtn.disabled = false;
      input.disabled   = false;
      input.focus();
    }
  }
}
