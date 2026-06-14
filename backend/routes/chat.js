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

Schüler-Frage: ${message.trim()}`;

    const result  = await model.generateContent(prompt);
    const reply   = result.response.text().trim();

    return res.json({ reply });

  } catch (err) {
    console.error('chat error:', err);
    return res.status(500).json({ message: 'KI antwortet gerade nicht. Bitte erneut versuchen.' });
  }
});

module.exports = router;
