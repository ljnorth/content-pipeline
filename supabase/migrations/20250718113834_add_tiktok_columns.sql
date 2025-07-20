-- Migration: Add TikTok API columns to account_profiles table
-- Run this on your production database

-- Add TikTok API connection columns if they don't exist
DO $$ 
BEGIN
    -- Add tiktok_access_token column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'account_profiles' 
                   AND column_name = 'tiktok_access_token') THEN
        ALTER TABLE account_profiles ADD COLUMN tiktok_access_token TEXT;
    END IF;
    
    -- Add tiktok_refresh_token column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'account_profiles' 
                   AND column_name = 'tiktok_refresh_token') THEN
        ALTER TABLE account_profiles ADD COLUMN tiktok_refresh_token TEXT;
    END IF;
    
    -- Add tiktok_expires_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'account_profiles' 
                   AND column_name = 'tiktok_expires_at') THEN
        ALTER TABLE account_profiles ADD COLUMN tiktok_expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add tiktok_connected_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'account_profiles' 
                   AND column_name = 'tiktok_connected_at') THEN
        ALTER TABLE account_profiles ADD COLUMN tiktok_connected_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    RAISE NOTICE 'TikTok columns added successfully to account_profiles table';
END $$;
