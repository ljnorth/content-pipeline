-- Pipeline Logging System
-- Run this in Supabase SQL Editor to add pipeline monitoring capabilities

-- Create pipeline runs table to track pipeline execution
CREATE TABLE IF NOT EXISTS public.pipeline_runs (
    id BIGSERIAL PRIMARY KEY,
    type TEXT NOT NULL, -- 'full', 'analysis', 'scraping', etc.
    status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    accounts_processed INTEGER DEFAULT 0,
    posts_processed INTEGER DEFAULT 0,
    images_processed INTEGER DEFAULT 0,
    error_message TEXT,
    logs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create pipeline logs table for detailed logging
CREATE TABLE IF NOT EXISTS public.pipeline_logs (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT REFERENCES public.pipeline_runs(id) ON DELETE CASCADE,
    level TEXT NOT NULL, -- 'info', 'warning', 'error', 'success'
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS pipeline_runs_status_idx ON public.pipeline_runs(status);
CREATE INDEX IF NOT EXISTS pipeline_runs_started_at_idx ON public.pipeline_runs(started_at);
CREATE INDEX IF NOT EXISTS pipeline_logs_run_id_idx ON public.pipeline_logs(run_id);
CREATE INDEX IF NOT EXISTS pipeline_logs_timestamp_idx ON public.pipeline_logs(timestamp);

-- Add RLS policies
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (you can restrict this later)
CREATE POLICY "Allow all operations on pipeline_runs" ON public.pipeline_runs
    FOR ALL USING (true);

CREATE POLICY "Allow all operations on pipeline_logs" ON public.pipeline_logs
    FOR ALL USING (true);

-- Create a view for recent pipeline activity
CREATE OR REPLACE VIEW public.recent_pipeline_activity AS
SELECT 
    pr.id,
    pr.type,
    pr.status,
    pr.started_at,
    pr.completed_at,
    pr.accounts_processed,
    pr.posts_processed,
    pr.images_processed,
    pr.error_message,
    CASE 
        WHEN pr.status = 'running' THEN '🔄'
        WHEN pr.status = 'completed' THEN '✅'
        WHEN pr.status = 'failed' THEN '❌'
        ELSE '❓'
    END as status_icon,
    EXTRACT(EPOCH FROM (pr.completed_at - pr.started_at)) as duration_seconds
FROM public.pipeline_runs pr
ORDER BY pr.started_at DESC
LIMIT 50;

-- Create a function to add pipeline logs
CREATE OR REPLACE FUNCTION public.add_pipeline_log(
    p_run_id BIGINT,
    p_level TEXT,
    p_message TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.pipeline_logs (run_id, level, message, metadata)
    VALUES (p_run_id, p_level, p_message, p_metadata);
END;
$$;

-- Create a function to update pipeline run status
CREATE OR REPLACE FUNCTION public.update_pipeline_run_status(
    p_run_id BIGINT,
    p_status TEXT,
    p_accounts_processed INTEGER DEFAULT NULL,
    p_posts_processed INTEGER DEFAULT NULL,
    p_images_processed INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.pipeline_runs 
    SET 
        status = p_status,
        completed_at = CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE completed_at END,
        accounts_processed = COALESCE(p_accounts_processed, accounts_processed),
        posts_processed = COALESCE(p_posts_processed, posts_processed),
        images_processed = COALESCE(p_images_processed, images_processed),
        error_message = COALESCE(p_error_message, error_message)
    WHERE id = p_run_id;
END;
$$; 