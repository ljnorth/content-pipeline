-- Image usage tracking table
CREATE TABLE IF NOT EXISTS image_usage (
    id SERIAL PRIMARY KEY,
    image_id INTEGER NOT NULL,
    account_username VARCHAR(255) NOT NULL,
    generation_id VARCHAR(255),
    post_number INTEGER,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign keys
    FOREIGN KEY (account_username) REFERENCES account_profiles(username) ON DELETE CASCADE,
    
    -- Indexes for performance
    INDEX idx_image_usage_image_account (image_id, account_username),
    INDEX idx_image_usage_used_at (used_at),
    INDEX idx_image_usage_account (account_username)
);

-- View to get image cooldown status
CREATE OR REPLACE VIEW image_cooldown_status AS
SELECT 
    iu.image_id,
    iu.account_username,
    COUNT(*) as usage_count,
    MAX(iu.used_at) as last_used_at,
    -- Calculate posts since last use (estimate based on time and typical posting frequency)
    CASE 
        WHEN MAX(iu.used_at) IS NULL THEN 999 -- Never used
        WHEN MAX(iu.used_at) < NOW() - INTERVAL '7 days' THEN 999 -- Old enough to reuse
        ELSE 0 -- Recently used, check actual post count
    END as estimated_posts_since_last_use
FROM image_usage iu
GROUP BY iu.image_id, iu.account_username; 