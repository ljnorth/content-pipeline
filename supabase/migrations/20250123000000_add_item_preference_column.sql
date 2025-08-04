-- Migration: Add item_preference column for Phase 2.3
-- This column will classify images as: single_item, full_outfit, or on_person

-- Add the item_preference column to images table
ALTER TABLE public.images 
ADD COLUMN IF NOT EXISTS item_preference TEXT DEFAULT NULL;

-- Add an index for better query performance
CREATE INDEX IF NOT EXISTS idx_images_item_preference 
ON public.images(item_preference);

-- Add a check constraint to ensure only valid values
ALTER TABLE public.images 
ADD CONSTRAINT IF NOT EXISTS check_item_preference_values 
CHECK (item_preference IS NULL OR item_preference IN ('single_item', 'full_outfit', 'on_person', 'error', 'unknown'));

-- Add a comment to document the column
COMMENT ON COLUMN public.images.item_preference IS 'Classification of image content: single_item (individual items), full_outfit (complete outfits), on_person (person wearing clothes)'; 