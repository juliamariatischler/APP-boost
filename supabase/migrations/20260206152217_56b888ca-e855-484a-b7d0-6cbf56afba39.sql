-- Add steps column to daily_results table
ALTER TABLE public.daily_results 
ADD COLUMN IF NOT EXISTS steps integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS steps_tracking_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS steps_started_at timestamp with time zone;