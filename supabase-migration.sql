-- Piano Experience Database Schema
-- Run this in the SQL Editor of your new Supabase project

-- User profiles (auto-approved)
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  approved boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Categories for organizing pieces
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text, -- null = system default, email = user-created
  name text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Seed default categories
INSERT INTO categories (name, sort_order) VALUES
  ('New Piece', 0),
  ('Technical Piece', 1),
  ('In Progress', 2),
  ('Finished Piece', 3);

-- Pieces (main table)
CREATE TABLE pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL, -- user email
  title text NOT NULL,
  composer text,
  book_title text,
  book_editor text,
  key_signature text,
  time_signature text,
  tempo_marking text,
  difficulty_level text,
  period text,
  ai_summary text,
  metronome_marking text,
  areas_of_focus text,
  goals text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Piece images
CREATE TABLE piece_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  image_type text NOT NULL DEFAULT 'first_page', -- first_page, full_piece, book_cover
  created_at timestamptz DEFAULT now()
);

-- Piece notes (timestamped)
CREATE TABLE piece_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  user_id text NOT NULL, -- user email
  note_type text NOT NULL DEFAULT 'practice', -- practice, lesson, general
  note text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Interesting facts (AI-generated)
CREATE TABLE interesting_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  fact text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Practice schedule
CREATE TABLE practice_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL, -- user email
  piece_id uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL, -- 0=Monday, 6=Sunday
  focus_notes text,
  sort_order integer DEFAULT 0,
  week_start_date date NOT NULL,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Activity log
CREATE TABLE activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text,
  action text NOT NULL,
  piece_id uuid,
  piece_title text,
  details text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pieces_user ON pieces(user_id);
CREATE INDEX idx_pieces_category ON pieces(category_id);
CREATE INDEX idx_piece_notes_piece ON piece_notes(piece_id);
CREATE INDEX idx_piece_images_piece ON piece_images(piece_id);
CREATE INDEX idx_interesting_facts_piece ON interesting_facts(piece_id);
CREATE INDEX idx_practice_schedule_user_week ON practice_schedule(user_id, week_start_date);
CREATE INDEX idx_activity_log_user ON activity_log(user_email);
CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE piece_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE piece_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE interesting_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- User profiles: users can read their own, service role manages
CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Service role full access to profiles" ON user_profiles FOR ALL USING (auth.role() = 'service_role');

-- Categories: users see system defaults + their own
CREATE POLICY "Users can read categories" ON categories FOR SELECT USING (user_id IS NULL OR user_id = auth.jwt()->>'email');
CREATE POLICY "Users can create own categories" ON categories FOR INSERT WITH CHECK (user_id = auth.jwt()->>'email');

-- Pieces: users see and manage their own
CREATE POLICY "Users can read own pieces" ON pieces FOR SELECT USING (user_id = auth.jwt()->>'email');
CREATE POLICY "Users can create pieces" ON pieces FOR INSERT WITH CHECK (user_id = auth.jwt()->>'email');
CREATE POLICY "Users can update own pieces" ON pieces FOR UPDATE USING (user_id = auth.jwt()->>'email');
CREATE POLICY "Users can delete own pieces" ON pieces FOR DELETE USING (user_id = auth.jwt()->>'email');

-- Piece images: follow piece ownership
CREATE POLICY "Users can read own piece images" ON piece_images FOR SELECT USING (
  piece_id IN (SELECT id FROM pieces WHERE user_id = auth.jwt()->>'email')
);
CREATE POLICY "Users can manage own piece images" ON piece_images FOR ALL USING (
  piece_id IN (SELECT id FROM pieces WHERE user_id = auth.jwt()->>'email')
);

-- Piece notes: follow piece ownership
CREATE POLICY "Users can read own piece notes" ON piece_notes FOR SELECT USING (user_id = auth.jwt()->>'email');
CREATE POLICY "Users can create notes" ON piece_notes FOR INSERT WITH CHECK (user_id = auth.jwt()->>'email');
CREATE POLICY "Users can delete own notes" ON piece_notes FOR DELETE USING (user_id = auth.jwt()->>'email');

-- Interesting facts: follow piece ownership
CREATE POLICY "Users can read own facts" ON interesting_facts FOR SELECT USING (
  piece_id IN (SELECT id FROM pieces WHERE user_id = auth.jwt()->>'email')
);
CREATE POLICY "Service role manages facts" ON interesting_facts FOR ALL USING (auth.role() = 'service_role');

-- Practice schedule: users manage their own
CREATE POLICY "Users can read own schedule" ON practice_schedule FOR SELECT USING (user_id = auth.jwt()->>'email');
CREATE POLICY "Users can create schedule items" ON practice_schedule FOR INSERT WITH CHECK (user_id = auth.jwt()->>'email');
CREATE POLICY "Users can update own schedule" ON practice_schedule FOR UPDATE USING (user_id = auth.jwt()->>'email');
CREATE POLICY "Users can delete own schedule" ON practice_schedule FOR DELETE USING (user_id = auth.jwt()->>'email');

-- Activity log: service role manages, users can read their own
CREATE POLICY "Users can read own activity" ON activity_log FOR SELECT USING (user_email = auth.jwt()->>'email');
CREATE POLICY "Service role full access to activity" ON activity_log FOR ALL USING (auth.role() = 'service_role');

-- Create storage bucket for piece images
INSERT INTO storage.buckets (id, name, public) VALUES ('piece-images', 'piece-images', true);

-- Storage policy: authenticated users can upload
CREATE POLICY "Authenticated users can upload images" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'piece-images' AND auth.role() = 'authenticated'
);
CREATE POLICY "Public can read piece images" ON storage.objects FOR SELECT USING (
  bucket_id = 'piece-images'
);

-- Auto-update updated_at on pieces
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pieces_updated_at
  BEFORE UPDATE ON pieces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
