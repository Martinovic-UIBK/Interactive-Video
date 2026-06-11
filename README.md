# 🏔️ Innsbruck Erkunden – Interaktive Lernplattform

Eine interaktive Stadttour durch Innsbruck für Schüler/innen der 4. Klasse Mittelschule.  
12 Stationen mit YouTube-Videos und KI-bewerteten Fragen (Google Gemini).

---

## 📁 Projektstruktur

```
/                        ← Frontend (GitHub Pages)
├── index.html           ← Haupt-App
├── login.html           ← Login
├── register.html        ← Registrierung
├── style.css            ← Alle Styles
├── app.js               ← App-Logik
├── questions.js         ← 12 Stationen (editierbar ohne Coding)
└── backend/             ← Backend (Render)
    ├── server.js
    ├── package.json
    ├── .env.example
    ├── supabase.sql
    └── routes/
        ├── auth.js
        ├── evaluate.js
        └── progress.js
```

---

## 🚀 Deployment

### Schritt 1: Supabase Datenbank einrichten

1. Gehe zu [supabase.com](https://supabase.com) → dein Projekt
2. **SQL Editor** öffnen
3. Inhalt von `backend/supabase.sql` einfügen und ausführen
4. Notiere dir:
   - **Project URL** (Settings → API)
   - **anon key** (Settings → API)
   - **service_role key** (Settings → API → *Service Role*)

---

### Schritt 2: Backend auf Render deployen

1. Gehe zu [render.com](https://render.com) → **New Web Service**
2. Verbinde dein GitHub-Repository
3. Einstellungen:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. Unter **Environment** folgende Variablen eintragen:

| Variable | Wert |
|---|---|
| `SUPABASE_URL` | deine Supabase Project URL |
| `SUPABASE_ANON_KEY` | dein Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | dein Supabase service_role key |
| `GEMINI_API_KEY` | dein Google Gemini API Key |
| `JWT_SECRET` | zufälliger langer String (min. 32 Zeichen) |
| `ALLOWED_ORIGIN` | `https://martinovic-uibk.github.io` |
| `PORT` | `3000` |

5. Deploy starten → URL notieren, z.B. `https://mein-backend.onrender.com`

---

### Schritt 3: Frontend-URLs anpassen

In **drei Dateien** die Backend-URL eintragen (nach `DEIN-BACKEND` suchen):

```js
// In: app.js, login.html, register.html
return 'https://DEIN-BACKEND.onrender.com';
// → ersetzen durch deine echte Render-URL, z.B.:
return 'https://innsbruck-backend.onrender.com';
```

---

### Schritt 4: GitHub Pages aktivieren

1. GitHub Repository → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main`, Folder: `/ (root)`
4. Speichern → App unter `https://martinovic-uibk.github.io/Interactive-Video/`

---

### Schritt 5: YouTube-Videos eintragen

Öffne `questions.js` und ersetze alle `REPLACE_ME_XX` durch echte YouTube-Video-IDs:

```js
// Beispiel: https://www.youtube.com/watch?v=dQw4w9WgXcQ
// Die Video-ID ist: dQw4w9WgXcQ
youtubeId: "dQw4w9WgXcQ",
```

---

## 🔑 Lokale Entwicklung

```bash
# Backend starten
cd backend
cp .env.example .env
# .env mit echten Werten befüllen
npm install
npm run dev

# Frontend: index.html im Browser öffnen
# Empfehlung: VS Code Live Server Extension (Port 5500)
```

---

## ⚙️ Tech Stack

| Bereich | Technologie |
|---|---|
| Frontend | Vanilla HTML/CSS/JS, GitHub Pages |
| Backend | Node.js, Express, Render |
| Datenbank | Supabase (PostgreSQL) |
| KI | Google Gemini 1.5 Flash |
| Auth | JWT + bcrypt |
| Fonts | Google Fonts (Inter) |

---

## ❓ Häufige Probleme

**Backend antwortet nicht?**  
Render Free-Tier schläft nach 15 Min Inaktivität ein. Erster Request dauert ~30 Sekunden.

**CORS-Fehler?**  
`ALLOWED_ORIGIN` in den Render-Umgebungsvariablen prüfen – muss exakt mit der GitHub Pages URL übereinstimmen.

**YouTube-Video lädt nicht?**  
Video-ID in `questions.js` prüfen. Video muss öffentlich sein und Einbettung erlauben.

**Gemini antwortet nicht?**  
`GEMINI_API_KEY` in den Render-Umgebungsvariablen prüfen. Kostenloses Kontingent reicht für den Schulbetrieb aus.
