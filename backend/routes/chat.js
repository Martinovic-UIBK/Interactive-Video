// ============================================================
// routes/chat.js – Test-Chatbot via Google Gemini
// ============================================================
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const jwt = require('jsonwebtoken');

const router = express.Router();

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
// POST /api/chat
// Body: { message: string }
// ----------------------------------------------------------
router.post('/', authenticate, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Nachricht darf nicht leer sein.' });
    }

    if (message.trim().length > 500) {
      return res.status(400).json({ message: 'Nachricht zu lang (max. 500 Zeichen).' });
    }

    const prompt = `Du bist ein freundlicher Lernassistent für Schüler der 4. Klasse Mittelschule,
die gerade eine interaktive Stadttour durch Innsbruck machen.
Beantworte Fragen auf Deutsch, einfach und verständlich.
Halte deine Antworten kurz (max. 3-4 Sätze).

WICHTIGE REGEL: Die folgenden Themen/Fragen gehören zu den Quiz-Aufgaben im Video und dürfen NICHT beantwortet werden:
- Hungerburgbahn (Was ist das für ein Fahrzeug?)
- Welcher Berg ist von der Hungerburg aus zu sehen?
- Wofür steht ORF?
- Wie groß ist der Hofgarten?
- Wie viele Bronzestatuen stehen in der Hofkirche?
- Was macht den Flüsterbogen besonders?
- Wie hoch ist der Materialwert des Goldenen Dachls?
- Wie schmal ist Innsbrucks kleinstes Haus?
- Was kosten die Döner zusammen?
- Wie heißt die Sehenswürdigkeit / Was ist das (Triumphpforte)?
- Welches Gebäude wurde zuletzt im Video gezeigt / Haus der Begegnung?
- Wie viel kosten 6 Magnete / Souvenir-Magnete Preis?
- Woher kommt der Name Innsbruck / wie ist der Name Innsbruck entstanden?

Wenn eine Frage erkennbar eine dieser Quiz-Aufgaben oder deren direkte Antwort abfragt, antworte freundlich aber bestimmt: "Das ist eine der Quiz-Fragen im Video – die sollst du selbst herausfinden! 😊 Ich helfe dir gerne bei anderen Fragen über Innsbruck."

Schüler-Frage: ${message.trim()}`;

    const result  = await model.generateContent(prompt);
    const reply   = result.response.text().trim();

    return res.json({ reply });

  } catch (err) {
    console.error('chat error:', err?.message || err, err?.status, err?.statusText);
    return res.status(500).json({ message: `KI-Fehler: ${err?.message || 'Unbekannt'}` });
  }
});

module.exports = router;
