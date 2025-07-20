-- Background Color Analysis Schema Updates
-- Run these commands in Supabase SQL editor

-- Add background color columns to existing images table
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS primary_bg_color TEXT;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS secondary_bg_color TEXT;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS bg_color_hex TEXT;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS bg_type TEXT;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS bg_brightness TEXT;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS uniformity_score DECIMAL(3,2);
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS suitable_for_matching BOOLEAN DEFAULT false;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS background_analysis JSONB DEFAULT '{}';

-- Create indexes for background color queries
CREATE INDEX IF NOT EXISTS images_primary_bg_color_idx ON public.images(primary_bg_color);
CREATE INDEX IF NOT EXISTS images_bg_brightness_idx ON public.images(bg_brightness);
CREATE INDEX IF NOT EXISTS images_suitable_for_matching_idx ON public.images(suitable_for_matching);
CREATE INDEX IF NOT EXISTS images_uniformity_score_idx ON public.images(uniformity_score);

-- Create a view for images grouped by background color families
CREATE OR REPLACE VIEW public.background_color_groups AS
SELECT 
    primary_bg_color,
    bg_brightness,
    COUNT(*) as image_count,
    AVG(uniformity_score) as avg_uniformity,
    COUNT(CASE WHEN suitable_for_matching = true THEN 1 END) as suitable_count,
    ARRAY_AGG(DISTINCT aesthetic) as aesthetics_found,
    ARRAY_AGG(DISTINCT username) as usernames
FROM public.images
WHERE primary_bg_color IS NOT NULL
GROUP BY primary_bg_color, bg_brightness
ORDER BY image_count DESC;

-- Create a view for high-quality uniform backgrounds
CREATE OR REPLACE VIEW public.uniform_backgrounds AS
SELECT 
    i.*,
    p.engagement_rate,
    p.like_count,
    p.view_count
FROM public.images i
INNER JOIN public.posts p ON i.post_id = p.post_id
WHERE i.suitable_for_matching = true 
    AND i.uniformity_score >= 0.7
ORDER BY i.uniformity_score DESC, p.engagement_rate DESC NULLS LAST;

-- Create a view for background color analytics
CREATE OR REPLACE VIEW public.background_analytics AS
WITH color_performance AS (
    SELECT 
        i.primary_bg_color,
        i.bg_brightness,
        COUNT(*) as total_images,
        AVG(p.engagement_rate) as avg_engagement,
        AVG(p.like_count) as avg_likes,
        AVG(i.uniformity_score) as avg_uniformity,
        COUNT(CASE WHEN i.suitable_for_matching = true THEN 1 END) as matching_suitable
    FROM public.images i
    INNER JOIN public.posts p ON i.post_id = p.post_id
    WHERE i.primary_bg_color IS NOT NULL
    GROUP BY i.primary_bg_color, i.bg_brightness
)
SELECT 
    *,
    ROUND((matching_suitable::DECIMAL / total_images * 100), 1) as matching_percentage,
    CASE 
        WHEN avg_engagement > 0.05 AND avg_uniformity > 0.8 THEN 'excellent'
        WHEN avg_engagement > 0.03 AND avg_uniformity > 0.6 THEN 'good'
        WHEN avg_uniformity > 0.5 THEN 'moderate'
        ELSE 'poor'
    END as quality_rating
FROM color_performance
ORDER BY avg_engagement DESC NULLS LAST, avg_uniformity DESC;

-- Function to update background color information from analysis
CREATE OR REPLACE FUNCTION update_image_background_colors()
RETURNS void AS $$
BEGIN
    -- Update images table with background analysis data
    -- This would be called after running background color analysis
    UPDATE public.images 
    SET 
        primary_bg_color = background_analysis->>'primary_bg_color',
        secondary_bg_color = background_analysis->>'secondary_bg_color',
        bg_color_hex = background_analysis->>'bg_color_hex',
        bg_type = background_analysis->>'bg_type',
        bg_brightness = background_analysis->>'bg_brightness',
        uniformity_score = (background_analysis->>'uniformity_score')::DECIMAL,
        suitable_for_matching = (background_analysis->>'suitable_for_matching')::BOOLEAN,
        updated_at = NOW()
    WHERE background_analysis IS NOT NULL 
        AND background_analysis != '{}'::jsonb
        AND primary_bg_color IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to get images with matching background colors
CREATE OR REPLACE FUNCTION get_color_matched_images(
    target_color TEXT DEFAULT NULL,
    target_brightness TEXT DEFAULT NULL,
    min_uniformity DECIMAL DEFAULT 0.7,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
    id BIGINT,
    post_id TEXT,
    username TEXT,
    image_path TEXT,
    aesthetic TEXT,
    primary_bg_color TEXT,
    uniformity_score DECIMAL,
    engagement_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.post_id,
        i.username,
        i.image_path,
        i.aesthetic,
        i.primary_bg_color,
        i.uniformity_score,
        p.engagement_rate
    FROM public.images i
    INNER JOIN public.posts p ON i.post_id = p.post_id
    WHERE i.suitable_for_matching = true
        AND i.uniformity_score >= min_uniformity
        AND (target_color IS NULL OR i.primary_bg_color = target_color)
        AND (target_brightness IS NULL OR i.bg_brightness = target_brightness)
    ORDER BY i.uniformity_score DESC, p.engagement_rate DESC NULLS LAST
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to suggest matching background colors for content generation
CREATE OR REPLACE FUNCTION suggest_background_colors(
    aesthetic_filter TEXT DEFAULT NULL,
    username_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    primary_bg_color TEXT,
    bg_brightness TEXT,
    image_count BIGINT,
    avg_uniformity DECIMAL,
    avg_engagement DECIMAL,
    recommendation_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.primary_bg_color,
        i.bg_brightness,
        COUNT(*)::BIGINT as image_count,
        AVG(i.uniformity_score) as avg_uniformity,
        AVG(p.engagement_rate) as avg_engagement,
        -- Calculate recommendation score (uniformity * engagement * availability)
        (AVG(i.uniformity_score) * COALESCE(AVG(p.engagement_rate), 0.01) * LOG(COUNT(*) + 1)) as recommendation_score
    FROM public.images i
    INNER JOIN public.posts p ON i.post_id = p.post_id
    WHERE i.suitable_for_matching = true
        AND i.uniformity_score >= 0.6
        AND (aesthetic_filter IS NULL OR i.aesthetic ILIKE '%' || aesthetic_filter || '%')
        AND (username_filter IS NULL OR i.username = username_filter)
    GROUP BY i.primary_bg_color, i.bg_brightness
    HAVING COUNT(*) >= 3  -- At least 3 images with this background
    ORDER BY recommendation_score DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql; 