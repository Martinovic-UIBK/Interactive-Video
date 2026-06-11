// ============================================================
// routes/auth.js – Registrierung & Login
// ============================================================
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Supabase-Client mit Service-Role-Key (umgeht RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SALT_ROUNDS = 12;
const JWT_EXPIRES = '7d';

function generateToken(userId, username) {
  return jwt.sign(
    { userId, username },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// ----------------------------------------------------------
// POST /api/auth/register
// Body: { username, password }
// ----------------------------------------------------------
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validierung
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ message: 'Benutzername muss mindestens 3 Zeichen haben.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'Passwort muss mindestens 6 Zeichen haben.' });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Prüfen ob Benutzername bereits vergeben
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ message: 'Dieser Benutzername ist bereits vergeben.' });
    }

    // Passwort hashen
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // User anlegen
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ username: cleanUsername, password_hash: passwordHash })
      .select('id, username')
      .single();

    if (error) {
      console.error('register insert error:', error);
      return res.status(500).json({ message: 'Registrierung fehlgeschlagen.' });
    }

    const token = generateToken(newUser.id, newUser.username);

    return res.status(201).json({
      token,
      userId:   newUser.id,
      username: newUser.username
    });

  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ message: 'Interner Fehler bei der Registrierung.' });
  }
});

// ----------------------------------------------------------
// POST /api/auth/login
// Body: { username, password }
// ----------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Benutzername und Passwort erforderlich.' });
    }

    const cleanUsername = username.trim().toLowerCase();

    // User suchen
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password_hash')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({ message: 'Benutzername oder Passwort falsch.' });
    }

    // Passwort prüfen
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Benutzername oder Passwort falsch.' });
    }

    const token = generateToken(user.id, user.username);

    return res.json({
      token,
      userId:   user.id,
      username: user.username
    });

  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ message: 'Interner Fehler beim Login.' });
  }
});

module.exports = router;
