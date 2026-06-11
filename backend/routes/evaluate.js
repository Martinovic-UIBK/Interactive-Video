// ============================================================
// routes/evaluate.js – KI-Bewertung mit Google Gemini
// ============================================================
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
// POST /api/evaluate
// Body: { stationId, question, keyInfo, answer }
// ----------------------------------------------------------
router.post('/', authenticate, async (req, res) => {
  try {
    const { stationId, question, keyInfo, answer } = req.body;

    // Eingabe-Validierung
    if (!stationId || !question || !keyInfo || !answer) {
      return res.status(400).json({ message: 'stationId, question, keyInfo und answer sind erforderlich.' });
    }
    if (typeof answer !== 'string' || answer.trim().length === 0) {
      return res.status(400).json({ message: 'Antwort darf nicht leer sein.' });
    }
    if (stationId < 1 || stationId > 12) {
      return res.status(400).json({ message: 'Ungültige Stations-ID.' });
    }

    // Prüfen ob Station bereits korrekt beantwortet
    const { data: existingProgress } = await supabase
      .from('progress')
      .select('is_correct')
      .eq('user_id', req.user.userId)
      .eq('station_number', stationId)
      .maybeSingle();

    if (existingProgress && existingProgress.is_correct) {
      return res.json({
        correct:  true,
        feedback: 'Du hast diese Station bereits erfolgreich abgeschlossen! 🎉'
      });
    }

    // Gemini-Bewertung
    const prompt = `Du bist ein freundlicher Lernassistent für Schüler der 4. Klasse Mittelschule (ca. 14-15 Jahre alt).

Bewerte ob die Schülerantwort inhaltlich korrekt ist.

Frage: ${question}

Erwartete Kerninhalte: ${keyInfo}

Schülerantwort: ${answer.trim()}

Antworte NUR mit einem JSON-Objekt in dieser exakten Form (kein Markdown, kein zusätzlicher Text):
{"correct": boolean, "feedback": "string"}

Regeln:
- correct ist true wenn die Antwort mindestens 2 der erwarteten Kerninhalte korrekt erwähnt
- feedback ist auf Deutsch, motivierend, max. 3 Sätze
- Bei correct true: loben und eventuell ergänzende Info geben
- Bei correct false: ermutigen und einen Hinweis geben ohne die Antwort zu verraten`;

    const result   = await model.generateContent(prompt);
    const rawText  = result.response.text().trim();

    // JSON aus der Antwort extrahieren
    let parsed;
    try {
      // Manchmal gibt Gemini Markdown-Code-Blöcke zurück – bereinigen
      const jsonStr = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/,    '')
        .trim();
      parsed = JSON.parse(jsonStr);
    } catch (_) {
      console.error('Gemini response konnte nicht geparst werden:', rawText);
      return res.status(502).json({
        message: 'KI-Antwort konnte nicht verarbeitet werden. Bitte nochmals versuchen.'
      });
    }

    const isCorrect = Boolean(parsed.correct);
    const feedback  = typeof parsed.feedback === 'string'
      ? parsed.feedback
      : 'Bewertung abgeschlossen.';

    // Fortschritt in Supabase speichern (UPSERT)
    const { error: upsertErr } = await supabase
      .from('progress')
      .upsert(
        {
          user_id:        req.user.userId,
          station_number: stationId,
          video_watched:  true,
          answer_text:    answer.trim(),
          is_correct:     isCorrect,
          feedback:       feedback,
          completed_at:   isCorrect ? new Date().toISOString() : null,
          updated_at:     new Date().toISOString()
        },
        { onConflict: 'user_id,station_number' }
      );

    if (upsertErr) {
      console.error('progress upsert error:', upsertErr);
      // Trotzdem Bewertung zurückgeben – Speichern fehlgeschlagen ist kein kritischer Fehler
    }

    return res.json({ correct: isCorrect, feedback });

  } catch (err) {
    console.error('evaluate error:', err);
    return res.status(500).json({ message: 'Fehler bei der KI-Bewertung. Bitte erneut versuchen.' });
  }
});

module.exports = router;
