-- Migration script to extract data from analysis JSONB into separate columns
-- Run this in Supabase SQL Editor to update existing data

-- Update existing images to extract data from analysis JSONB
UPDATE public.images 
SET 
  aesthetic = analysis->>'aesthetic',
  colors = analysis->'colors',
  season = analysis->>'season',
  occasion = analysis->>'occasion',
  additional = analysis->'additional'
WHERE analysis IS NOT NULL 
  AND (aesthetic IS NULL OR season IS NULL OR occasion IS NULL);

-- Create a view for better querying of stylistic data
CREATE OR REPLACE VIEW public.stylistic_insights AS
SELECT 
  i.id,
  i.post_id,
  i.username,
  i.aesthetic,
  i.season,
  i.occasion,
  i.colors,
  i.additional,
  p.engagement_rate,
  p.like_count,
  p.view_count,
  p.comment_count,
  p.save_count,
  p.created_at,
  -- Calculate performance score (weighted average of engagement metrics)
  (
    COALESCE(p.engagement_rate, 0) * 0.4 +
    COALESCE(p.like_count, 0) * 0.3 +
    COALESCE(p.view_count, 0) * 0.2 +
    COALESCE(p.comment_count, 0) * 0.1
  ) as performance_score
FROM public.images i
INNER JOIN public.posts p ON i.post_id = p.post_id
WHERE i.aesthetic IS NOT NULL;

-- Create a view for trending analysis
CREATE OR REPLACE VIEW public.trending_analysis AS
WITH aesthetic_trends AS (
  SELECT 
    aesthetic,
    COUNT(*) as total_count,
    AVG(performance_score) as avg_performance,
    AVG(engagement_rate) as avg_engagement,
    AVG(like_count) as avg_likes,
    AVG(view_count) as avg_views,
    -- Calculate trend (posts in last 7 days vs previous 7 days)
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_count,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days' THEN 1 END) as previous_count
  FROM public.stylistic_insights
  WHERE aesthetic IS NOT NULL
  GROUP BY aesthetic
),
season_trends AS (
  SELECT 
    season,
    COUNT(*) as total_count,
    AVG(performance_score) as avg_performance,
    AVG(engagement_rate) as avg_engagement,
    AVG(like_count) as avg_likes,
    AVG(view_count) as avg_views,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_count,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days' THEN 1 END) as previous_count
  FROM public.stylistic_insights
  WHERE season IS NOT NULL
  GROUP BY season
),
color_trends AS (
  SELECT 
    color,
    COUNT(*) as total_count,
    AVG(performance_score) as avg_performance,
    AVG(engagement_rate) as avg_engagement,
    AVG(like_count) as avg_likes,
    AVG(view_count) as avg_views,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_count,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days' THEN 1 END) as previous_count
  FROM (
    SELECT 
      jsonb_array_elements_text(colors) as color,
      performance_score,
      engagement_rate,
      like_count,
      view_count,
      created_at
    FROM public.stylistic_insights
    WHERE colors IS NOT NULL
  ) color_data
  GROUP BY color
)
SELECT 
  'aesthetic' as category,
  aesthetic as name,
  total_count,
  avg_performance,
  avg_engagement,
  avg_likes,
  avg_views,
  recent_count,
  previous_count,
  CASE 
    WHEN previous_count = 0 THEN 0
    ELSE ROUND(((recent_count::float - previous_count::float) / previous_count::float) * 100, 1)
  END as trend_percentage
FROM aesthetic_trends
WHERE total_count >= 3  -- Only show aesthetics with at least 3 posts

UNION ALL

SELECT 
  'season' as category,
  season as name,
  total_count,
  avg_performance,
  avg_engagement,
  avg_likes,
  avg_views,
  recent_count,
  previous_count,
  CASE 
    WHEN previous_count = 0 THEN 0
    ELSE ROUND(((recent_count::float - previous_count::float) / previous_count::float) * 100, 1)
  END as trend_percentage
FROM season_trends
WHERE total_count >= 3

UNION ALL

SELECT 
  'color' as category,
  color as name,
  total_count,
  avg_performance,
  avg_engagement,
  avg_likes,
  avg_views,
  recent_count,
  previous_count,
  CASE 
    WHEN previous_count = 0 THEN 0
    ELSE ROUND(((recent_count::float - previous_count::float) / previous_count::float) * 100, 1)
  END as trend_percentage
FROM color_trends
WHERE total_count >= 3
ORDER BY trend_percentage DESC, avg_performance DESC;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS images_aesthetic_idx ON public.images(aesthetic);
CREATE INDEX IF NOT EXISTS images_season_idx ON public.images(season);
CREATE INDEX IF NOT EXISTS images_occasion_idx ON public.images(occasion);
CREATE INDEX IF NOT EXISTS images_created_at_idx ON public.images(created_at); 