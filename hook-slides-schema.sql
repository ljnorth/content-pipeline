-- Schema for Hook Slides Detection and Theme Management
-- Run these commands in Supabase SQL editor

-- Table to store detected hook slides
CREATE TABLE IF NOT EXISTS public.hook_slides (
    id BIGSERIAL PRIMARY KEY,
    username TEXT REFERENCES public.accounts(username) ON DELETE CASCADE,
    post_id TEXT REFERENCES public.posts(post_id) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    
    -- Hook slide analysis results
    is_hook_slide BOOLEAN DEFAULT true,
    confidence DECIMAL(3,2), -- 0.00 to 1.00
    text_detected TEXT,
    theme TEXT,
    content_direction TEXT,
    target_vibe TEXT,
    
    -- Additional analysis
    hook_analysis JSONB DEFAULT '{}', -- Store full analysis JSON
    
    -- Usage tracking
    times_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Performance when used as hook
    generated_content_ids TEXT[], -- Track what content was generated from this hook
    avg_performance DECIMAL(5,4), -- Average engagement when this hook is used
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to store theme-based content generations
CREATE TABLE IF NOT EXISTS public.theme_generations (
    id BIGSERIAL PRIMARY KEY,
    hook_slide_id BIGINT REFERENCES public.hook_slides(id) ON DELETE CASCADE,
    account_username TEXT REFERENCES public.accounts(username) ON DELETE CASCADE,
    
    -- Generation parameters
    theme TEXT NOT NULL,
    target_vibe TEXT,
    content_direction TEXT,
    
    -- Generated content
    selected_images JSONB DEFAULT '[]', -- Array of selected image objects
    image_count INTEGER DEFAULT 0,
    
    -- Account adaptation
    account_aesthetic_focus TEXT[], -- How theme was adapted for this account
    background_colors TEXT[], -- Colors used for consistency
    
    -- Performance tracking
    engagement_prediction DECIMAL(5,4),
    actual_performance DECIMAL(5,4),
    posted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS hook_slides_username_idx ON public.hook_slides(username);
CREATE INDEX IF NOT EXISTS hook_slides_theme_idx ON public.hook_slides(theme);
CREATE INDEX IF NOT EXISTS hook_slides_target_vibe_idx ON public.hook_slides(target_vibe);
CREATE INDEX IF NOT EXISTS hook_slides_confidence_idx ON public.hook_slides(confidence);
CREATE INDEX IF NOT EXISTS hook_slides_times_used_idx ON public.hook_slides(times_used);

CREATE INDEX IF NOT EXISTS theme_generations_hook_slide_idx ON public.theme_generations(hook_slide_id);
CREATE INDEX IF NOT EXISTS theme_generations_account_idx ON public.theme_generations(account_username);
CREATE INDEX IF NOT EXISTS theme_generations_theme_idx ON public.theme_generations(theme);

-- Create a view for high-performing hook slides
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

-- Create a view for theme analytics
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

-- RLS Policies (if needed)
ALTER TABLE public.hook_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_generations ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (you can restrict this later)
CREATE POLICY "Allow all operations on hook_slides" ON public.hook_slides
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on theme_generations" ON public.theme_generations
    FOR ALL USING (true);

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

-- Function to calculate hook slide performance
CREATE OR REPLACE FUNCTION calculate_hook_slide_performance(slide_id BIGINT)
RETURNS DECIMAL AS $$
DECLARE
    avg_perf DECIMAL;
BEGIN
    SELECT AVG(actual_performance) INTO avg_perf
    FROM public.theme_generations
    WHERE hook_slide_id = slide_id 
    AND actual_performance IS NOT NULL;
    
    UPDATE public.hook_slides 
    SET avg_performance = avg_perf,
        updated_at = NOW()
    WHERE id = slide_id;
    
    RETURN COALESCE(avg_perf, 0);
END;
$$ LANGUAGE plpgsql; 