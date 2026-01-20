-- Enable realtime for challenge_invitations table
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_invitations;

-- Add battle_started_at column to track when both players are ready
ALTER TABLE public.challenge_invitations 
ADD COLUMN battle_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN challenger_ready BOOLEAN DEFAULT false,
ADD COLUMN opponent_ready BOOLEAN DEFAULT false;