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
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
    const { stationId, question, keyInfo, answer, points, attempts } = req.body;

    // Eingabe-Validierung
    if (!stationId || !question || !keyInfo || !answer) {
      return res.status(400).json({ message: 'stationId, question, keyInfo und answer sind erforderlich.' });
    }
    if (typeof answer !== 'string' || answer.trim().length === 0) {
      return res.status(400).json({ message: 'Antwort darf nicht leer sein.' });
    }
    if (typeof stationId !== 'number' || stationId < 1) {
      return res.status(400).json({ message: 'Ungültige Stations-ID.' });
    }

    // Kurze-Antwort-Pre-Check (vor Gemini)
    const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 3 || answer.trim().length < 15) {
      return res.json({
        correct:  false,
        feedback: 'Kannst du das noch etwas genauer beschreiben? 🤔 Schreib ruhig einen ganzen Satz!'
      });
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
    const prompt = `Du bist ein einfühlsamer, geduldiger Lernassistent für Schüler der 4. Klasse Mittelschule (ca. 14-15 Jahre alt).

Bewerte ob die Schülerantwort inhaltlich korrekt ist.

Frage: ${question}

Erwartete Kerninhalte: ${keyInfo}

Schülerantwort: ${answer.trim()}

Antworte NUR mit einem JSON-Objekt in dieser exakten Form (kein Markdown, kein zusätzlicher Text):
{"correct": boolean, "feedback": "string"}

Regeln:
- correct ist true wenn die Antwort inhaltlich sinnvoll ist und mindestens 1-2 der erwarteten Kerninhalte trifft
- WICHTIG: Wenn die Antwort sehr kurz ist (weniger als 3 Wörter oder weniger als 15 Zeichen), ist correct IMMER false. Feedback dann: "Kannst du das noch etwas genauer beschreiben? 🤔 Schreib ruhig einen ganzen Satz!"
- WICHTIG bei Fragen nach konkreten Zahlen/Preisen/Mengen: Wenn die Antwort um mehr als das 5-fache vom richtigen Wert abweicht, ist correct IMMER false
- Bei kreativen/offenen Fragen ohne feste Zahl: großzügig bewerten, eigene Gedanken und kreative Antworten sind willkommen – solange sie mehr als ein paar Wörter umfassen
- feedback ist auf Deutsch, max. 3 kurze Sätze, einfache Sprache für 14-Jährige
- Bei correct true: kurz und herzlich loben (z.B. "Super gemacht! 🎉"), dann eine interessante Zusatzinfo
- Bei correct false: NIEMALS entmutigen. Zuerst etwas Positives sagen falls möglich. Dann einen konkreten Tipp geben der in die richtige Richtung zeigt, OHNE die Antwort direkt zu verraten. Zum Schluss aufmuntern (z.B. "Du schaffst das! 💪")
- Vermeide Formulierungen wie "leider", "falsch", "nicht richtig" – stattdessen: "fast", "guter Ansatz", "noch ein kleiner Schritt fehlt"`;

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
          points:         isCorrect ? (points || 0) : 0,
          attempts:       attempts || 1,
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
    console.error('evaluate error:', err?.message || err, err?.status, err?.statusText);
    return res.status(500).json({ message: `KI-Fehler: ${err?.message || 'Unbekannt'}` });
  }
});

module.exports = router;
