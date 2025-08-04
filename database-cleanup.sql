-- Database Sync Fix Script
-- This script adds missing hook slide columns to the images table
-- and creates a helper function for proper hook slide updates

-- ========================================
-- 1. ADD MISSING HOOK SLIDE COLUMNS
-- ========================================

-- Add hook slide detection columns if they don't exist
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS is_cover_slide BOOLEAN DEFAULT NULL;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS cover_slide_text TEXT DEFAULT NULL;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS hook_slide_confidence DECIMAL(3,2) DEFAULT NULL;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS hook_slide_theme TEXT DEFAULT NULL;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS hook_slide_analysis JSONB DEFAULT '{}';

-- ========================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ========================================

-- Indexes for hook slide detection
CREATE INDEX IF NOT EXISTS images_is_cover_slide_idx ON public.images(is_cover_slide);
CREATE INDEX IF NOT EXISTS images_hook_slide_theme_idx ON public.images(hook_slide_theme);
CREATE INDEX IF NOT EXISTS images_hook_slide_confidence_idx ON public.images(hook_slide_confidence);

-- ========================================
-- 3. CREATE HELPER FUNCTION FOR PROPER UPDATES
-- ========================================

-- Function to safely update hook slide data for a specific image
CREATE OR REPLACE FUNCTION update_hook_slide_by_image_path(
    p_post_id TEXT,
    p_image_path TEXT,
    p_is_cover_slide BOOLEAN,
    p_confidence DECIMAL(3,2),
    p_text TEXT,
    p_theme TEXT,
    p_analysis JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    -- Update the specific image by post_id AND image_path
    UPDATE public.images 
    SET 
        is_cover_slide = p_is_cover_slide,
        hook_slide_confidence = p_confidence,
        cover_slide_text = p_text,
        hook_slide_theme = p_theme,
        hook_slide_analysis = p_analysis,
        updated_at = NOW()
    WHERE post_id = p_post_id 
    AND image_path = p_image_path;
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    
    -- Return true if we updated exactly one row
    RETURN rows_updated = 1;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. VERIFICATION QUERIES
-- ========================================

-- Check current state
SELECT 
    'Total images' as metric,
    COUNT(*) as count
FROM public.images
UNION ALL
SELECT 
    'Images with post_id' as metric,
    COUNT(*) as count
FROM public.images 
WHERE post_id IS NOT NULL
UNION ALL
SELECT 
    'Unique post_ids' as metric,
    COUNT(DISTINCT post_id) as count
FROM public.images 
WHERE post_id IS NOT NULL
UNION ALL
SELECT 
    'Images per post (avg)' as metric,
    ROUND(AVG(image_count), 1) as count
FROM (
    SELECT post_id, COUNT(*) as image_count
    FROM public.images 
    WHERE post_id IS NOT NULL
    GROUP BY post_id
) post_stats;

-- Show sample multi-image posts (this is normal!)
SELECT 
    post_id,
    COUNT(*) as image_count,
    array_agg(SUBSTRING(image_path FROM '([^/]+)$') ORDER BY id) as image_files
FROM public.images 
WHERE post_id IS NOT NULL
GROUP BY post_id 
HAVING COUNT(*) > 1
ORDER BY image_count DESC 
LIMIT 5;
