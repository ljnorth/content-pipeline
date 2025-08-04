-- Complete Production Schema for Content Pipeline
-- This includes ALL tables needed for content generation to work
-- Run this in your Supabase SQL editor to fix the production environment

-- ========================================
-- 1. ENHANCE EXISTING TABLES
-- ========================================

-- Add missing columns to images table
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS aesthetic TEXT;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS colors TEXT[];
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS season TEXT;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS occasion TEXT;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS additional TEXT[];
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS primary_bg_color TEXT;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS secondary_bg_color TEXT;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS bg_color_hex TEXT;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS bg_type TEXT;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS bg_brightness TEXT;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS uniformity_score DECIMAL(3,2);
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS suitable_for_matching BOOLEAN DEFAULT false;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS background_analysis JSONB DEFAULT '{}';
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS item_preference TEXT DEFAULT NULL;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add missing columns to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS text TEXT;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ========================================
-- 2. ACCOUNT PROFILES (CRITICAL FOR CONTENT GENERATION)
-- ========================================

CREATE TABLE IF NOT EXISTS public.account_profiles (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    account_type VARCHAR(50) DEFAULT 'owned',
    platform VARCHAR(50) DEFAULT 'tiktok',
    
    -- Target audience
    target_audience JSONB DEFAULT '{}',
    
    -- Content strategy
    content_strategy JSONB DEFAULT '{}',
    
    -- Performance goals
    performance_goals JSONB DEFAULT '{}',
    
    -- Posting schedule
    posting_schedule JSONB DEFAULT '{}',
    
    -- TikTok API connection
    tiktok_access_token TEXT,
    tiktok_refresh_token TEXT,
    tiktok_expires_at TIMESTAMP WITH TIME ZONE,
    tiktok_connected_at TIMESTAMP WITH TIME ZONE,
    
    -- Account stats
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    total_posts INTEGER DEFAULT 0,
    avg_engagement_rate DECIMAL(5,4) DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- ========================================
-- 3. GENERATED POSTS (TRACKS CONTENT CREATED BY PIPELINE)
-- ========================================

CREATE TABLE IF NOT EXISTS public.generated_posts (
    id SERIAL PRIMARY KEY,
    account_username VARCHAR(255) NOT NULL,
    generation_id VARCHAR(255),
    
    -- Post content
    image_paths TEXT[],
    selected_image_path TEXT,
    caption TEXT,
    hashtags TEXT[],
    
    -- Post metadata
    platform_post_id VARCHAR(255),
    posted_at TIMESTAMP WITH TIME ZONE,
    
    -- Performance data
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    saves_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,4) DEFAULT 0,
    
    -- Performance tracking
    performance_snapshots JSONB DEFAULT '[]',
    last_performance_check TIMESTAMP WITH TIME ZONE,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'generated', -- 'generated', 'posted', 'performing'
    platform VARCHAR(50) DEFAULT 'tiktok',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 4. HOOK SLIDES (FOR THEME-BASED CONTENT)
-- ========================================

CREATE TABLE IF NOT EXISTS public.hook_slides (
    id BIGSERIAL PRIMARY KEY,
    username TEXT REFERENCES public.accounts(username) ON DELETE CASCADE,
    post_id TEXT REFERENCES public.posts(post_id) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    
    -- Hook slide analysis results
    is_hook_slide BOOLEAN DEFAULT true,
    confidence DECIMAL(3,2),
    text_detected TEXT,
    theme TEXT,
    content_direction TEXT,
    target_vibe TEXT,
    
    -- Additional analysis
    hook_analysis JSONB DEFAULT '{}',
    
    -- Usage tracking
    times_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Performance when used as hook
    generated_content_ids TEXT[],
    avg_performance DECIMAL(5,4),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 5. THEME GENERATIONS (TRACKS THEME-BASED CONTENT)
-- ========================================

CREATE TABLE IF NOT EXISTS public.theme_generations (
    id BIGSERIAL PRIMARY KEY,
    hook_slide_id BIGINT REFERENCES public.hook_slides(id) ON DELETE CASCADE,
    account_username TEXT,
    
    -- Generation parameters
    theme TEXT NOT NULL,
    target_vibe TEXT,
    content_direction TEXT,
    
    -- Generated content
    selected_images JSONB DEFAULT '[]',
    image_count INTEGER DEFAULT 0,
    
    -- Account adaptation
    account_aesthetic_focus TEXT[],
    background_colors TEXT[],
    
    -- Performance tracking
    engagement_prediction DECIMAL(5,4),
    actual_performance DECIMAL(5,4),
    posted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 6. SAVED GENERATIONS (ENHANCED GENERATION TRACKING)
-- ========================================

CREATE TABLE IF NOT EXISTS public.saved_generations (
    id SERIAL PRIMARY KEY,
    generation_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    account_username VARCHAR(255),
    
    -- Generation parameters
    generation_type VARCHAR(100), -- 'ai', 'theme', 'simple', 'workflow'
    generation_params JSONB DEFAULT '{}',
    
    -- Generated content
    image_data JSONB DEFAULT '[]',
    image_count INTEGER DEFAULT 0,
    
    -- Usage tracking
    used_images TEXT[],
    performance_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 7. PERFORMANCE ANALYTICS
-- ========================================

CREATE TABLE IF NOT EXISTS public.performance_analytics (
    id SERIAL PRIMARY KEY,
    account_username VARCHAR(255) NOT NULL,
    
    -- Time period
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    period_type VARCHAR(50),
    
    -- Aesthetic performance
    aesthetic_performance JSONB DEFAULT '{}',
    color_performance JSONB DEFAULT '{}',
    posting_time_performance JSONB DEFAULT '{}',
    
    -- Overall metrics
    total_posts INTEGER DEFAULT 0,
    avg_engagement_rate DECIMAL(5,4) DEFAULT 0,
    best_performing_aesthetic VARCHAR(255),
    best_performing_time VARCHAR(10),
    
    -- Insights
    insights JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 8. PIPELINE TRACKING TABLES
-- ========================================

CREATE TABLE IF NOT EXISTS public.pipeline_runs (
    id SERIAL PRIMARY KEY,
    run_id VARCHAR(255) UNIQUE NOT NULL,
    pipeline_type VARCHAR(100), -- 'enhanced', 'fast', 'batch', 'test'
    status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed'
    
    -- Run parameters
    parameters JSONB DEFAULT '{}',
    
    -- Results
    images_processed INTEGER DEFAULT 0,
    posts_created INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pipeline_logs (
    id SERIAL PRIMARY KEY,
    run_id VARCHAR(255),
    level VARCHAR(20), -- 'info', 'warn', 'error'
    message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (run_id) REFERENCES public.pipeline_runs(run_id) ON DELETE CASCADE
);

-- ========================================
-- 9. IMAGE USAGE TRACKING
-- ========================================

CREATE TABLE IF NOT EXISTS public.image_usage (
    id SERIAL PRIMARY KEY,
    image_id BIGINT REFERENCES public.images(id) ON DELETE CASCADE,
    account_username VARCHAR(255),
    generation_id VARCHAR(255),
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Usage context
    usage_type VARCHAR(50), -- 'post', 'theme', 'ai'
    post_number INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 10. ANALYTICS VIEWS
-- ========================================

-- Recent pipeline activity view
CREATE OR REPLACE VIEW public.recent_pipeline_activity AS
SELECT 
    pr.run_id,
    pr.pipeline_type,
    pr.status,
    pr.images_processed,
    pr.posts_created,
    pr.started_at,
    pr.completed_at,
    pr.duration_seconds,
    COUNT(pl.id) as log_count
FROM public.pipeline_runs pr
LEFT JOIN public.pipeline_logs pl ON pr.run_id = pl.run_id
WHERE pr.started_at >= NOW() - INTERVAL '7 days'
GROUP BY pr.id, pr.run_id, pr.pipeline_type, pr.status, pr.images_processed, pr.posts_created, pr.started_at, pr.completed_at, pr.duration_seconds
ORDER BY pr.started_at DESC;

-- Top performing hook slides view
CREATE OR REPLACE VIEW public.top_hook_slides AS
SELECT 
    h.*,
    COUNT(t.id) as generation_count,
    AVG(t.actual_performance) as avg_generation_performance,
    MAX(t.created_at) as last_generation_date
FROM public.hook_slides h
LEFT JOIN public.theme_generations t ON h.id = t.hook_slide_id
WHERE h.confidence >= 0.7
GROUP BY h.id
ORDER BY h.times_used DESC, h.confidence DESC;

-- Theme analytics view
CREATE OR REPLACE VIEW public.theme_analytics AS
SELECT 
    theme,
    target_vibe,
    COUNT(*) as hook_slide_count,
    AVG(confidence) as avg_confidence,
    SUM(times_used) as total_usage,
    AVG(avg_performance) as avg_performance
FROM public.hook_slides
WHERE is_hook_slide = true AND confidence >= 0.7
GROUP BY theme, target_vibe
ORDER BY total_usage DESC, avg_performance DESC;

-- Background color groups view
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

-- ========================================
-- 11. INDEXES FOR PERFORMANCE
-- ========================================

-- Account profiles indexes
CREATE INDEX IF NOT EXISTS idx_account_profiles_username ON public.account_profiles(username);
CREATE INDEX IF NOT EXISTS idx_account_profiles_active ON public.account_profiles(is_active);

-- Generated posts indexes
CREATE INDEX IF NOT EXISTS idx_generated_posts_account ON public.generated_posts(account_username);
CREATE INDEX IF NOT EXISTS idx_generated_posts_posted_at ON public.generated_posts(posted_at);
CREATE INDEX IF NOT EXISTS idx_generated_posts_status ON public.generated_posts(status);

-- Hook slides indexes
CREATE INDEX IF NOT EXISTS hook_slides_username_idx ON public.hook_slides(username);
CREATE INDEX IF NOT EXISTS hook_slides_theme_idx ON public.hook_slides(theme);
CREATE INDEX IF NOT EXISTS hook_slides_target_vibe_idx ON public.hook_slides(target_vibe);
CREATE INDEX IF NOT EXISTS hook_slides_confidence_idx ON public.hook_slides(confidence);
CREATE INDEX IF NOT EXISTS hook_slides_times_used_idx ON public.hook_slides(times_used);

-- Theme generations indexes
CREATE INDEX IF NOT EXISTS theme_generations_hook_slide_idx ON public.theme_generations(hook_slide_id);
CREATE INDEX IF NOT EXISTS theme_generations_account_idx ON public.theme_generations(account_username);
CREATE INDEX IF NOT EXISTS theme_generations_theme_idx ON public.theme_generations(theme);

-- Images enhanced indexes
CREATE INDEX IF NOT EXISTS images_aesthetic_idx ON public.images(aesthetic);
CREATE INDEX IF NOT EXISTS images_colors_idx ON public.images USING GIN(colors);
CREATE INDEX IF NOT EXISTS images_season_idx ON public.images(season);
CREATE INDEX IF NOT EXISTS images_occasion_idx ON public.images(occasion);
CREATE INDEX IF NOT EXISTS images_additional_idx ON public.images USING GIN(additional);
CREATE INDEX IF NOT EXISTS images_primary_bg_color_idx ON public.images(primary_bg_color);
CREATE INDEX IF NOT EXISTS images_bg_brightness_idx ON public.images(bg_brightness);
CREATE INDEX IF NOT EXISTS images_suitable_for_matching_idx ON public.images(suitable_for_matching);
CREATE INDEX IF NOT EXISTS images_uniformity_score_idx ON public.images(uniformity_score);

-- Pipeline tracking indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_type ON public.pipeline_runs(pipeline_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON public.pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started_at ON public.pipeline_runs(started_at);

-- Image usage indexes
CREATE INDEX IF NOT EXISTS idx_image_usage_image_id ON public.image_usage(image_id);
CREATE INDEX IF NOT EXISTS idx_image_usage_account ON public.image_usage(account_username);
CREATE INDEX IF NOT EXISTS idx_image_usage_used_at ON public.image_usage(used_at);

-- ========================================
-- 12. SAMPLE DATA FOR TESTING
-- ========================================

-- Insert a sample account profile for testing
INSERT INTO public.account_profiles (username, display_name, account_type, target_audience, content_strategy, performance_goals, posting_schedule) 
VALUES 
('fashionista_lj', 'Fashion LJ', 'owned', 
 '{"age": "18-25", "interests": ["streetwear", "sneakers", "urban culture"], "location": "urban", "gender": "mixed"}',
 '{"aestheticFocus": ["streetwear", "casual", "urban"], "colorPalette": ["neutral", "earth tones"], "contentTypes": ["outfit posts", "styling tips"], "postingStyle": "authentic"}',
 '{"primaryMetric": "likes", "targetRate": 0.08, "secondaryMetric": "saves", "growthGoal": "engagement"}',
 '{"frequency": "daily", "bestTimes": ["18:00", "20:00", "12:00"], "timezone": "EST"}'
)
ON CONFLICT (username) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    target_audience = EXCLUDED.target_audience,
    content_strategy = EXCLUDED.content_strategy,
    performance_goals = EXCLUDED.performance_goals,
    posting_schedule = EXCLUDED.posting_schedule,
    updated_at = NOW();

-- ========================================
-- 13. FUNCTIONS FOR AUTOMATION
-- ========================================

-- Function to update account profile stats
CREATE OR REPLACE FUNCTION update_account_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.account_profiles 
    SET 
        avg_engagement_rate = (
            SELECT AVG(engagement_rate) 
            FROM public.generated_posts 
            WHERE account_username = NEW.account_username
        ),
        total_posts = (
            SELECT COUNT(*) 
            FROM public.generated_posts 
            WHERE account_username = NEW.account_username
        ),
        updated_at = NOW()
    WHERE username = NEW.account_username;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update hook slide usage stats
CREATE OR REPLACE FUNCTION update_hook_slide_usage(slide_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE public.hook_slides 
    SET 
        times_used = times_used + 1,
        last_used_at = NOW(),
        updated_at = NOW()
    WHERE id = slide_id;
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

-- ========================================
-- 14. TRIGGERS
-- ========================================

-- Trigger to automatically update account stats
DROP TRIGGER IF EXISTS update_account_stats_trigger ON public.generated_posts;
CREATE TRIGGER update_account_stats_trigger
    AFTER INSERT OR UPDATE ON public.generated_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_account_profile_stats();

-- ========================================
-- 15. ROW LEVEL SECURITY (OPTIONAL)
-- ========================================

-- Enable RLS on new tables (you can restrict this later)
ALTER TABLE public.account_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hook_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_usage ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (you can restrict this later)
CREATE POLICY "Allow all operations on account_profiles" ON public.account_profiles FOR ALL USING (true);
CREATE POLICY "Allow all operations on generated_posts" ON public.generated_posts FOR ALL USING (true);
CREATE POLICY "Allow all operations on hook_slides" ON public.hook_slides FOR ALL USING (true);
CREATE POLICY "Allow all operations on theme_generations" ON public.theme_generations FOR ALL USING (true);
CREATE POLICY "Allow all operations on saved_generations" ON public.saved_generations FOR ALL USING (true);
CREATE POLICY "Allow all operations on performance_analytics" ON public.performance_analytics FOR ALL USING (true);
CREATE POLICY "Allow all operations on pipeline_runs" ON public.pipeline_runs FOR ALL USING (true);
CREATE POLICY "Allow all operations on pipeline_logs" ON public.pipeline_logs FOR ALL USING (true);
CREATE POLICY "Allow all operations on image_usage" ON public.image_usage FOR ALL USING (true);

-- ========================================
-- COMPLETION MESSAGE
-- ========================================

-- This schema includes ALL tables needed for content generation to work
-- After running this, your content generation endpoints should work properly
-- The main missing pieces were:
-- 1. account_profiles table (for targeting and strategy)
-- 2. generated_posts table (for tracking created content)
-- 3. hook_slides table (for theme-based content)
-- 4. theme_generations table (for theme tracking)
-- 5. saved_generations table (for generation history)
-- 6. Enhanced images table with aesthetic/color data
-- 7. Pipeline tracking tables
-- 8. Performance analytics tables 