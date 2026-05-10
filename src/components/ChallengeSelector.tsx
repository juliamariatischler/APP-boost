import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Challenge {
  id: string;
  name: string;
  description: string;
  icon: string;
  winner_points: number;
  loser_points: number;
}

interface ChallengeSelectorProps {
  selectedChallenge: Challenge | null;
  onChallengeSelect: (challenge: Challenge) => void;
}

export const ChallengeSelector = ({ selectedChallenge, onChallengeSelect }: ChallengeSelectorProps) => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      const { data, error } = await supabase
        .from('friend_challenges')
        .select('*')
        .order('winner_points', { ascending: false });

      if (error) throw error;
      setChallenges(data || []);
    } catch (error) {
      console.error('Error loading challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4 animate-pulse bg-muted h-28" />
        ))}
      </div>
    );
  }

  if (challenges.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-2">
        Keine Challenges verfügbar.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {challenges.map((challenge) => (
        <Card
          key={challenge.id}
          className={`p-4 cursor-pointer transition-all hover:scale-105 ${
            selectedChallenge?.id === challenge.id
              ? 'ring-2 ring-primary bg-primary/10'
              : 'hover:bg-muted/50'
          }`}
          onClick={() => onChallengeSelect(challenge)}
        >
          <div className="text-center space-y-2">
            <span className="text-3xl">{challenge.icon}</span>
            <h3 className="font-semibold text-sm">{challenge.name}</h3>
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 fill-primary text-primary" />
                <span className="text-xs font-black text-primary">+{challenge.winner_points} pro Person</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Für beide Teilnehmer:innen</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
