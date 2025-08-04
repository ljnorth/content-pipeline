-- Create discovered_themes table for Ultimate Content Generator
CREATE TABLE IF NOT EXISTS public.discovered_themes (
    id BIGSERIAL PRIMARY KEY,
    
    -- Theme identification
    theme_name TEXT UNIQUE NOT NULL,
    description TEXT,
    
    -- Content strategy
    keywords TEXT[],
    hashtags TEXT[],
    target_audience TEXT,
    content_direction TEXT,
    
    -- Pattern data (what makes this theme successful)
    aesthetic TEXT,
    season TEXT,
    occasion TEXT,
    colors TEXT[],
    
    -- Performance metrics
    avg_engagement_rate DECIMAL(5,4) DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    performance_score DECIMAL(5,2) DEFAULT 0, -- 0-100 score
    confidence_level TEXT CHECK (confidence_level IN ('low', 'medium', 'high')),
    
    -- Sample data
    sample_image_paths TEXT[], -- Example images that represent this theme
    
    -- Usage tracking
    times_used_for_generation INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_discovered_themes_performance ON public.discovered_themes(performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_themes_confidence ON public.discovered_themes(confidence_level);
CREATE INDEX IF NOT EXISTS idx_discovered_themes_aesthetic ON public.discovered_themes(aesthetic);
CREATE INDEX IF NOT EXISTS idx_discovered_themes_season ON public.discovered_themes(season);
CREATE INDEX IF NOT EXISTS idx_discovered_themes_active ON public.discovered_themes(is_active);
CREATE INDEX IF NOT EXISTS idx_discovered_themes_engagement ON public.discovered_themes(avg_engagement_rate DESC);

-- Add RLS policy
ALTER TABLE public.discovered_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on discovered_themes" ON public.discovered_themes FOR ALL USING (true);

-- Add helpful comments
COMMENT ON TABLE public.discovered_themes IS 'Stores themes discovered from high-performing content analysis';
COMMENT ON COLUMN public.discovered_themes.theme_name IS 'Catchy name for the theme (e.g., "Cozy Fall Vibes")';
COMMENT ON COLUMN public.discovered_themes.performance_score IS 'Score from 0-100 indicating how well this theme performs';
COMMENT ON COLUMN public.discovered_themes.confidence_level IS 'How confident we are in this theme (low/medium/high)';
COMMENT ON COLUMN public.discovered_themes.sample_image_paths IS 'Example images that represent this theme'; 