-- Create generations table for saving generated content
CREATE TABLE IF NOT EXISTS public.generations (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    images JSONB NOT NULL,
    settings JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS generations_created_at_idx ON public.generations(created_at);

-- Add RLS policies (optional)
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (you can restrict this later)
CREATE POLICY "Allow all operations on generations" ON public.generations
    FOR ALL USING (true); 