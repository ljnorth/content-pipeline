-- Database Schema Updates for Fashion Pipeline
-- Run these commands in Supabase SQL editor

-- Add missing columns to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_path text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS text text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS web_video_url text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS updated_at timestamptz default now();

-- Add missing columns to images table
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS image_index integer;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS image_type text;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS aesthetic text;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS colors jsonb;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS season text;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS occasion text;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS additional jsonb;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS updated_at timestamptz default now();

-- Add missing columns to accounts table
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS updated_at timestamptz default now();

-- Create unique constraint for images (post_id + image_index) - handle safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'images_post_id_image_index_unique'
    ) THEN
        ALTER TABLE public.images ADD CONSTRAINT images_post_id_image_index_unique UNIQUE (post_id, image_index);
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS posts_video_path_idx ON public.posts(video_path);
CREATE INDEX IF NOT EXISTS posts_web_video_url_idx ON public.posts(web_video_url);
CREATE INDEX IF NOT EXISTS images_image_type_idx ON public.images(image_type);
CREATE INDEX IF NOT EXISTS images_image_index_idx ON public.images(image_index);
