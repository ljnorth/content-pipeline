-- Add reroll tracking to preview_batches table
ALTER TABLE preview_batches 
ADD COLUMN reroll_count INTEGER DEFAULT 0,
ADD COLUMN reroll_history JSONB DEFAULT '[]';

-- Add index for better performance on reroll queries
CREATE INDEX IF NOT EXISTS idx_preview_batches_reroll_count ON preview_batches(reroll_count); 