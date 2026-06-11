-- ============================================================
-- supabase.sql – Datenbankschema für die Innsbruck-Lernplattform
-- Ausführen in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. TABELLEN
-- ============================================================

-- Benutzer-Tabelle
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  username      TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Fortschritts-Tabelle
CREATE TABLE IF NOT EXISTS public.progress (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  station_number INTEGER     NOT NULL CHECK (station_number BETWEEN 1 AND 12),
  video_watched  BOOLEAN     DEFAULT FALSE NOT NULL,
  answer_text    TEXT,
  is_correct     BOOLEAN     DEFAULT FALSE NOT NULL,
  feedback       TEXT,
  completed_at   TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Jeder User kann jede Station nur einmal haben
  CONSTRAINT progress_user_station_unique UNIQUE (user_id, station_number)
);

-- ============================================================
-- 2. INDIZES (Performance)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_progress_user_id
  ON public.progress(user_id);

CREATE INDEX IF NOT EXISTS idx_progress_station_number
  ON public.progress(station_number);

CREATE INDEX IF NOT EXISTS idx_users_username
  ON public.users(username);

-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- RLS aktivieren
ALTER TABLE public.users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;

-- HINWEIS: Das Backend verwendet den Service-Role-Key, der alle RLS-Policies
-- umgeht. Die folgenden Policies sind eine zusätzliche Sicherheitsebene,
-- falls jemals direkter Datenbankzugriff über den Anon-Key erfolgt.

-- ---- users-Tabelle ----

-- Niemand darf users direkt über den Anon-Key lesen (Backend übernimmt das)
CREATE POLICY "users: kein anon Lesen"
  ON public.users FOR SELECT
  USING (false);

-- Niemand darf users direkt über den Anon-Key schreiben
CREATE POLICY "users: kein anon Schreiben"
  ON public.users FOR INSERT
  WITH CHECK (false);

-- ---- progress-Tabelle ----

-- Niemand darf progress direkt über den Anon-Key lesen/schreiben
CREATE POLICY "progress: kein anon Lesen"
  ON public.progress FOR SELECT
  USING (false);

CREATE POLICY "progress: kein anon Schreiben"
  ON public.progress FOR INSERT
  WITH CHECK (false);

CREATE POLICY "progress: kein anon Aktualisieren"
  ON public.progress FOR UPDATE
  USING (false);

-- ============================================================
-- 4. UPDATED_AT automatisch aktualisieren (optional)
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_progress_updated_at
  BEFORE UPDATE ON public.progress
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. ÜBERPRÜFUNG (optional – nach Ausführung)
-- ============================================================

-- SELECT * FROM public.users   LIMIT 5;
-- SELECT * FROM public.progress LIMIT 5;
