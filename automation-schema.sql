-- Automation Schema for Daily TikTok Content Generation
-- Run this in Supabase SQL Editor to add automation tracking capabilities

-- Create automation runs table to track automation execution
CREATE TABLE IF NOT EXISTS public.automation_runs (
    id BIGSERIAL PRIMARY KEY,
    type TEXT NOT NULL, -- 'daily_content_generation', 'scheduled_upload', etc.
    status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    summary JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create automation logs table for detailed step tracking
CREATE TABLE IF NOT EXISTS public.automation_logs (
    id BIGSERIAL PRIMARY KEY,
    automation_id BIGINT REFERENCES public.automation_runs(id) ON DELETE CASCADE,
    step TEXT NOT NULL, -- 'content_generation', 'tiktok_upload', 'error_handling'
    status TEXT NOT NULL, -- 'started', 'completed', 'failed'
    result_data JSONB DEFAULT '{}'::jsonb,
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    execution_time_ms INTEGER
);

-- Extend account_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.account_profiles (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    account_type VARCHAR(50) DEFAULT 'owned', -- 'owned' or 'source'
    platform VARCHAR(50) DEFAULT 'tiktok',
    
    -- Target audience
    target_audience JSONB DEFAULT '{}'::jsonb, -- {age: "18-25", interests: ["streetwear"], location: "urban"}
    
    -- Content strategy
    content_strategy JSONB DEFAULT '{}'::jsonb, -- {aestheticFocus: ["streetwear"], colorPalette: ["neutral"]}
    
    -- Performance goals
    performance_goals JSONB DEFAULT '{}'::jsonb, -- {primaryMetric: "likes", targetRate: 0.08, secondaryMetric: "saves"}
    
    -- Posting schedule
    posting_schedule JSONB DEFAULT '{}'::jsonb, -- {frequency: "daily", bestTimes: ["18:00", "20:00"]}
    
    -- Account stats
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    total_posts INTEGER DEFAULT 0,
    avg_engagement_rate DECIMAL(5,4) DEFAULT 0,
    
    -- TikTok API credentials (encrypted in production)
    tiktok_access_token TEXT,
    tiktok_refresh_token TEXT,
    tiktok_client_key TEXT,
    tiktok_token_expires_at TIMESTAMP WITH TIME ZONE,
    tiktok_connected_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Extend generated_posts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.generated_posts (
    id SERIAL PRIMARY KEY,
    account_username VARCHAR(255) NOT NULL,
    generation_id VARCHAR(255), -- Links to automation runs
    
    -- Post content
    image_paths TEXT[], -- Array of image paths that were generated
    selected_image_path TEXT, -- The specific image that was actually posted
    caption TEXT,
    hashtags TEXT[],
    
    -- Post metadata
    platform_post_id VARCHAR(255), -- TikTok/Instagram post ID
    posted_at TIMESTAMP WITH TIME ZONE,
    
    -- Performance data
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    saves_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,4) DEFAULT 0,
    
    -- Performance tracking
    performance_snapshots JSONB DEFAULT '[]'::jsonb, -- Array of performance data over time
    last_performance_check TIMESTAMP WITH TIME ZONE,
    
    -- Automation tracking
    automation_run_id BIGINT REFERENCES public.automation_runs(id),
    upload_status TEXT DEFAULT 'pending', -- 'pending', 'uploaded', 'failed'
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (account_username) REFERENCES account_profiles(username) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS automation_runs_type_idx ON public.automation_runs(type);
CREATE INDEX IF NOT EXISTS automation_runs_status_idx ON public.automation_runs(status);
CREATE INDEX IF NOT EXISTS automation_runs_started_at_idx ON public.automation_runs(started_at);
CREATE INDEX IF NOT EXISTS automation_logs_automation_id_idx ON public.automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS automation_logs_step_idx ON public.automation_logs(step);
CREATE INDEX IF NOT EXISTS account_profiles_username_idx ON public.account_profiles(username);
CREATE INDEX IF NOT EXISTS account_profiles_active_idx ON public.account_profiles(is_active);
CREATE INDEX IF NOT EXISTS generated_posts_account_idx ON public.generated_posts(account_username);
CREATE INDEX IF NOT EXISTS generated_posts_automation_idx ON public.generated_posts(automation_run_id);
CREATE INDEX IF NOT EXISTS generated_posts_status_idx ON public.generated_posts(upload_status);

-- Add RLS policies
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_posts ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (you can restrict this later)
CREATE POLICY "Allow all operations on automation_runs" ON public.automation_runs
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on automation_logs" ON public.automation_logs
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on account_profiles" ON public.account_profiles
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on generated_posts" ON public.generated_posts
    FOR ALL USING (true);

-- Create a view for automation analytics
CREATE OR REPLACE VIEW public.automation_analytics AS
SELECT 
    DATE(started_at) as date,
    COUNT(*) as total_runs,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_runs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_runs,
    AVG(duration_seconds) as avg_duration_seconds,
    SUM((summary->>'postsGenerated')::int) as total_posts_generated,
    SUM((summary->>'uploadsSuccessful')::int) as total_uploads_successful,
    AVG((summary->>'completionRate')::float) as avg_completion_rate
FROM public.automation_runs 
WHERE type = 'daily_content_generation'
GROUP BY DATE(started_at)
ORDER BY date DESC;

-- Create helper functions
CREATE OR REPLACE FUNCTION public.get_automation_status()
RETURNS TABLE (
    status TEXT,
    last_run TIMESTAMPZ,
    next_estimated_run TIMESTAMPZ,
    total_runs_today INTEGER,
    success_rate_today FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(ar.status, 'idle') as status,
        ar.started_at as last_run,
        (CURRENT_DATE + INTERVAL '1 day' + TIME '09:00:00')::TIMESTAMPZ as next_estimated_run,
        COUNT(*)::INTEGER as total_runs_today,
        (COUNT(*) FILTER (WHERE ar.status = 'completed')::FLOAT / GREATEST(COUNT(*), 1)) * 100 as success_rate_today
    FROM public.automation_runs ar
    WHERE ar.type = 'daily_content_generation'
    AND DATE(ar.started_at) = CURRENT_DATE
    GROUP BY ar.status, ar.started_at
    ORDER BY ar.started_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Sample data for testing (optional)
-- You can uncomment these to create test accounts

/*
INSERT INTO public.account_profiles (username, display_name, account_type, content_strategy, target_audience) VALUES 
('fashionista_test', 'Fashion Test Account', 'owned', 
 '{"aestheticFocus": ["streetwear", "casual"], "colorPalette": ["neutral", "black", "white"]}'::jsonb,
 '{"age": "18-25", "interests": ["fashion", "streetwear"], "location": "urban"}'::jsonb),
('styleicon_test', 'Style Icon Test', 'owned', 
 '{"aestheticFocus": ["elegant", "chic"], "colorPalette": ["pastels", "neutrals"]}'::jsonb,
 '{"age": "22-30", "interests": ["fashion", "lifestyle"], "location": "suburban"}'::jsonb);
*/

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

SELECT 'Automation schema setup completed successfully!' as result; 