-- Create saved_generations table compatible with the API
CREATE TABLE IF NOT EXISTS saved_generations (
    id SERIAL PRIMARY KEY,
    generation_id VARCHAR(255) UNIQUE NOT NULL,
    account_username VARCHAR(255) NOT NULL,
    post_count INTEGER DEFAULT 0,
    image_count INTEGER DEFAULT 0,
    strategy JSONB DEFAULT '{}',
    generated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (account_username) REFERENCES account_profiles(username) ON DELETE CASCADE
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_saved_generations_account ON saved_generations(account_username);
CREATE INDEX IF NOT EXISTS idx_saved_generations_generation_id ON saved_generations(generation_id); 