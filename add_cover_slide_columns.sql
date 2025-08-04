-- Add columns to images table for cover slide detection
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS is_cover_slide BOOLEAN DEFAULT false;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS cover_slide_text TEXT;
