-- Create preview_batches table for Slack integration
CREATE TABLE IF NOT EXISTS preview_batches (
    id SERIAL PRIMARY KEY,
    preview_id TEXT UNIQUE NOT NULL,
    account_username TEXT NOT NULL,
    posts JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accessed_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_preview_batches_preview_id ON preview_batches(preview_id);
CREATE INDEX IF NOT EXISTS idx_preview_batches_account ON preview_batches(account_username);
CREATE INDEX IF NOT EXISTS idx_preview_batches_expires ON preview_batches(expires_at);

-- Add RLS policies
ALTER TABLE preview_batches ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (can be restricted later)
CREATE POLICY "Allow all operations on preview_batches" ON preview_batches
    FOR ALL USING (true);

-- Create a function to clean up old preview batches (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_preview_batches()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM preview_batches 
  WHERE created_at < now() - interval '30 days';
$$;

-- Add comment
COMMENT ON TABLE preview_batches IS 'Stores preview batch data for Slack integration';
COMMENT ON COLUMN preview_batches.preview_id IS 'Unique preview identifier used in URLs';
COMMENT ON COLUMN preview_batches.posts IS 'JSON data containing all posts in the preview';
COMMENT ON COLUMN preview_batches.expires_at IS 'When this preview expires and should be cleaned up'; 