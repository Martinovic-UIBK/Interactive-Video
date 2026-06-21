// ============================================================
// routes/scoreboard.js – Bestenliste
// ============================================================
const express = require('express');
const jwt     = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ message: 'Kein Token.' });
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch (_) {
    return res.status(401).json({ message: 'Ungültiges Token.' });
  }
}

// GET /api/scoreboard  – Top-Liste (nur public user)
router.get('/', authenticate, async (req, res) => {
  try {
    // Alle User mit show_on_scoreboard = true
    const { data: users, error: uErr } = await supabase
      .from('users')
      .select('id, username')
      .eq('show_on_scoreboard', true);

    if (uErr) throw uErr;

    // Punkte aggregieren
    const results = await Promise.all(users.map(async u => {
      const { data: rows } = await supabase
        .from('progress')
        .select('points')
        .eq('user_id', u.id)
        .eq('is_correct', true);

      const total = (rows || []).reduce((s, r) => s + (r.points || 0), 0);
      const answered = (rows || []).length;
      return { username: u.username, points: total, answered, isMe: u.id === req.user.userId };
    }));

    results.sort((a, b) => b.points - a.points || b.answered - a.answered);
    const ranked = results.map((r, i) => ({ ...r, rank: i + 1 }));

    return res.json({ scoreboard: ranked });
  } catch (err) {
    console.error('scoreboard error:', err);
    return res.status(500).json({ message: 'Scoreboard konnte nicht geladen werden.' });
  }
});

// PATCH /api/scoreboard/privacy  – Sichtbarkeit umschalten
router.patch('/privacy', authenticate, async (req, res) => {
  try {
    const { show } = req.body;
    const { error } = await supabase
      .from('users')
      .update({ show_on_scoreboard: !!show })
      .eq('id', req.user.userId);

    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    console.error('privacy error:', err);
    return res.status(500).json({ message: 'Einstellung konnte nicht gespeichert werden.' });
  }
});

// GET /api/scoreboard/me  – eigene Sichtbarkeit abfragen
router.get('/me', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('show_on_scoreboard')
      .eq('id', req.user.userId)
      .single();

    if (error) throw error;
    return res.json({ show_on_scoreboard: data.show_on_scoreboard });
  } catch (err) {
    return res.status(500).json({ message: 'Fehler.' });
  }
});

module.exports = router;
