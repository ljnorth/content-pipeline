-- Account Profiles Schema
-- This extends the existing accounts table with detailed profile information

-- Account profiles for owned accounts (your accounts you post to)
CREATE TABLE IF NOT EXISTS account_profiles (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    account_type VARCHAR(50) DEFAULT 'owned', -- 'owned' or 'source'
    platform VARCHAR(50) DEFAULT 'tiktok',
    
    -- Target audience
    target_audience JSONB DEFAULT '{}', -- {age: "18-25", interests: ["streetwear"], location: "urban"}
    
    -- Content strategy
    content_strategy JSONB DEFAULT '{}', -- {aestheticFocus: ["streetwear"], colorPalette: ["neutral"]}
    
    -- Performance goals
    performance_goals JSONB DEFAULT '{}', -- {primaryMetric: "likes", targetRate: 0.08, secondaryMetric: "saves"}
    
    -- Posting schedule
    posting_schedule JSONB DEFAULT '{}', -- {frequency: "daily", bestTimes: ["18:00", "20:00"]}
    
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

-- Generated posts (posts created from your pipeline and posted to your accounts)
CREATE TABLE IF NOT EXISTS generated_posts (
    id SERIAL PRIMARY KEY,
    account_username VARCHAR(255) NOT NULL,
    generation_id VARCHAR(255), -- Links to saved generations
    
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
    performance_snapshots JSONB DEFAULT '[]', -- Array of performance data over time
    last_performance_check TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (account_username) REFERENCES account_profiles(username) ON DELETE CASCADE
);

-- Performance analytics (aggregated data for learning)
CREATE TABLE IF NOT EXISTS performance_analytics (
    id SERIAL PRIMARY KEY,
    account_username VARCHAR(255) NOT NULL,
    
    -- Time period
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    period_type VARCHAR(50), -- 'daily', 'weekly', 'monthly'
    
    -- Aesthetic performance
    aesthetic_performance JSONB DEFAULT '{}', -- {streetwear: {posts: 5, avgEngagement: 0.08}}
    color_performance JSONB DEFAULT '{}',
    posting_time_performance JSONB DEFAULT '{}',
    
    -- Overall metrics
    total_posts INTEGER DEFAULT 0,
    avg_engagement_rate DECIMAL(5,4) DEFAULT 0,
    best_performing_aesthetic VARCHAR(255),
    best_performing_time VARCHAR(10),
    
    -- Insights
    insights JSONB DEFAULT '{}', -- AI-generated insights about performance
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (account_username) REFERENCES account_profiles(username) ON DELETE CASCADE
);

-- Saved generations (enhanced to link with account profiles)
CREATE TABLE IF NOT EXISTS saved_generations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    account_username VARCHAR(255), -- Which account this was generated for
    
    -- Generation parameters
    generation_params JSONB DEFAULT '{}', -- Original generation parameters
    
    -- Generated content
    image_data JSONB DEFAULT '[]', -- Array of generated images with metadata
    
    -- Usage tracking
    used_images TEXT[], -- Which images were actually used
    performance_data JSONB DEFAULT '{}', -- Performance of used images
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (account_username) REFERENCES account_profiles(username) ON DELETE SET NULL
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_account_profiles_username ON account_profiles(username);
CREATE INDEX IF NOT EXISTS idx_generated_posts_account ON generated_posts(account_username);
CREATE INDEX IF NOT EXISTS idx_generated_posts_posted_at ON generated_posts(posted_at);
CREATE INDEX IF NOT EXISTS idx_performance_analytics_account ON performance_analytics(account_username);
CREATE INDEX IF NOT EXISTS idx_performance_analytics_period ON performance_analytics(period_start, period_end);

-- Sample account profile data
INSERT INTO account_profiles (username, display_name, account_type, target_audience, content_strategy, performance_goals, posting_schedule) 
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

-- Function to update account profile stats
CREATE OR REPLACE FUNCTION update_account_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update average engagement rate when new post is added
    UPDATE account_profiles 
    SET 
        avg_engagement_rate = (
            SELECT AVG(engagement_rate) 
            FROM generated_posts 
            WHERE account_username = NEW.account_username
        ),
        total_posts = (
            SELECT COUNT(*) 
            FROM generated_posts 
            WHERE account_username = NEW.account_username
        ),
        updated_at = NOW()
    WHERE username = NEW.account_username;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update account stats
CREATE TRIGGER update_account_stats_trigger
    AFTER INSERT OR UPDATE ON generated_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_account_profile_stats(); 