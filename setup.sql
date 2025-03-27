-- Create the stories table if it doesn't exist
CREATE TABLE IF NOT EXISTS stories (
    id BIGSERIAL PRIMARY KEY,
    academic_grade TEXT NOT NULL,
    subject TEXT NOT NULL,
    subject_specification TEXT,
    setting TEXT,
    main_character TEXT,
    word_count INTEGER NOT NULL,
    language TEXT NOT NULL,
    story_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add RLS (Row Level Security) policies
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- Allow insert for authenticated users
CREATE POLICY "Allow insert for authenticated users" ON stories
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow select for all users
CREATE POLICY "Allow select for all users" ON stories
    FOR SELECT
    TO public
    USING (true); 