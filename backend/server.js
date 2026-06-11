// ============================================================
// server.js – Express-Backend für die Innsbruck-Lernplattform
// ============================================================
require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const authRoutes     = require('./routes/auth');
const evaluateRoutes = require('./routes/evaluate');
const progressRoutes = require('./routes/progress');
const chatRoutes     = require('./routes/chat');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---- Middleware ----

// CORS: erlaubt Zugriff vom Frontend (GitHub Pages + localhost)
const allowedOrigins = ['https://martinovic-uibk.github.io', 'http://localhost:3000'];
app.use(cors({
  origin: ['https://martinovic-uibk.github.io', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

// ---- Health-Check ----
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- Routes ----
app.use('/api/auth',     authRoutes);
app.use('/api/evaluate', evaluateRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/chat',     chatRoutes);

// ---- 404 Handler ----
app.use((_req, res) => {
  res.status(404).json({ message: 'Route nicht gefunden.' });
});

// ---- Globaler Fehler-Handler ----
app.use((err, _req, res, _next) => {
  console.error('Unbehandelter Fehler:', err);
  res.status(500).json({ message: 'Interner Serverfehler.' });
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`✅ Backend läuft auf Port ${PORT}`);
  console.log(`   Erlaubte Origins: ${allowedOrigins.join(', ')}`);
});
