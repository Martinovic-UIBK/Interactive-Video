// ============================================================
// routes/progress.js – Fortschritt lesen & aktualisieren
// ============================================================
const express = require('express');
const jwt     = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ---- Auth-Middleware ----
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Kein Authentifizierungs-Token.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (_) {
    return res.status(401).json({ message: 'Ungültiges oder abgelaufenes Token.' });
  }
}

// ----------------------------------------------------------
// GET /api/progress
// Gibt den gesamten Fortschritt des eingeloggten Users zurück
// ----------------------------------------------------------
router.get('/', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('progress')
      .select('id, station_number, video_watched, answer_text, is_correct, feedback, completed_at')
      .eq('user_id', req.user.userId)
      .order('station_number', { ascending: true });

    if (error) {
      console.error('progress fetch error:', error);
      return res.status(500).json({ message: 'Fortschritt konnte nicht geladen werden.' });
    }

    return res.json({ progress: data || [] });

  } catch (err) {
    console.error('GET /progress error:', err);
    return res.status(500).json({ message: 'Interner Fehler.' });
  }
});

// ----------------------------------------------------------
// POST /api/progress/video-watched/:stationNumber
// Markiert ein Video als gesehen (ohne Antwort zu überschreiben)
// ----------------------------------------------------------
router.post('/video-watched/:stationNumber', authenticate, async (req, res) => {
  try {
    const stationNumber = parseInt(req.params.stationNumber, 10);

    if (isNaN(stationNumber) || stationNumber < 1 || stationNumber > 12) {
      return res.status(400).json({ message: 'Ungültige Stations-Nummer.' });
    }

    // Prüfen ob Eintrag bereits existiert
    const { data: existing } = await supabase
      .from('progress')
      .select('id, video_watched')
      .eq('user_id', req.user.userId)
      .eq('station_number', stationNumber)
      .maybeSingle();

    if (existing && existing.video_watched) {
      // Bereits als gesehen markiert
      return res.json({ success: true, already: true });
    }

    const { error } = await supabase
      .from('progress')
      .upsert(
        {
          user_id:        req.user.userId,
          station_number: stationNumber,
          video_watched:  true,
          updated_at:     new Date().toISOString()
        },
        { onConflict: 'user_id,station_number' }
      );

    if (error) {
      console.error('video-watched upsert error:', error);
      return res.status(500).json({ message: 'Konnte Video-Status nicht speichern.' });
    }

    return res.json({ success: true });

  } catch (err) {
    console.error('POST /video-watched error:', err);
    return res.status(500).json({ message: 'Interner Fehler.' });
  }
});

module.exports = router;
