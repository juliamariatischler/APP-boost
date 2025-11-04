-- Add points column to profiles table with default value of 0
ALTER TABLE public.profiles 
ADD COLUMN points integer NOT NULL DEFAULT 0;