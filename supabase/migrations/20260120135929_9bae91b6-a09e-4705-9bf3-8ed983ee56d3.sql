-- Create friend_challenges table for available challenge types
CREATE TABLE public.friend_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  winner_points INTEGER NOT NULL DEFAULT 50,
  loser_points INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.friend_challenges ENABLE ROW LEVEL SECURITY;

-- Anyone can view challenges
CREATE POLICY "Anyone can view friend challenges"
ON public.friend_challenges
FOR SELECT
USING (true);

-- Admins can manage challenges
CREATE POLICY "Admins can manage friend challenges"
ON public.friend_challenges
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create friend_requests table for managing friendships
CREATE TABLE public.friend_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- Enable RLS
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own friend requests
CREATE POLICY "Users can view their friend requests"
ON public.friend_requests
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send friend requests
CREATE POLICY "Users can send friend requests"
ON public.friend_requests
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Users can update friend requests they received
CREATE POLICY "Users can respond to friend requests"
ON public.friend_requests
FOR UPDATE
USING (auth.uid() = receiver_id);

-- Create challenge_invitations table for challenge battles
CREATE TABLE public.challenge_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID REFERENCES public.friend_challenges(id) ON DELETE CASCADE NOT NULL,
  challenger_id UUID NOT NULL,
  opponent_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'in_progress', 'completed', 'cancelled')),
  challenger_result INTEGER,
  opponent_result INTEGER,
  winner_id UUID,
  invite_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.challenge_invitations ENABLE ROW LEVEL SECURITY;

-- Users can view their own challenge invitations
CREATE POLICY "Users can view their challenge invitations"
ON public.challenge_invitations
FOR SELECT
USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- Users can create challenge invitations
CREATE POLICY "Users can create challenge invitations"
ON public.challenge_invitations
FOR INSERT
WITH CHECK (auth.uid() = challenger_id);

-- Participants can update challenge invitations
CREATE POLICY "Participants can update challenge invitations"
ON public.challenge_invitations
FOR UPDATE
USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- Admins can view all
CREATE POLICY "Admins can view all challenge invitations"
ON public.challenge_invitations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at on friend_requests
CREATE TRIGGER update_friend_requests_updated_at
BEFORE UPDATE ON public.friend_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on challenge_invitations
CREATE TRIGGER update_challenge_invitations_updated_at
BEFORE UPDATE ON public.challenge_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();