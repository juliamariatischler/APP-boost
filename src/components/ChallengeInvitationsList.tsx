import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Check, X, Clock, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface ChallengeInvitation {
  id: string;
  status: string;
  challenger_id: string;
  opponent_id: string;
  challenger_result: number | null;
  opponent_result: number | null;
  winner_id: string | null;
  created_at: string;
  challenge: {
    name: string;
    icon: string;
    winner_points: number;
    loser_points: number;
  };
  challenger_profile?: {
    username: string;
  };
  opponent_profile?: {
    username: string;
  };
}

interface ChallengeInvitationsListProps {
  userId: string;
  onStartChallenge?: (invitation: ChallengeInvitation) => void;
}

export const ChallengeInvitationsList = ({ userId, onStartChallenge }: ChallengeInvitationsListProps) => {
  const [invitations, setInvitations] = useState<ChallengeInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvitations();
  }, [userId]);

  const loadInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('challenge_invitations')
        .select(`
          *,
          challenge:friend_challenges(name, icon, winner_points, loser_points)
        `)
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Load profile information for each invitation
      const invitationsWithProfiles = await Promise.all(
        (data || []).map(async (inv) => {
          const challengerProfile = await supabase
            .from('profiles')
            .select('username')
            .eq('id', inv.challenger_id)
            .maybeSingle();
          
          const opponentProfile = await supabase
            .from('profiles')
            .select('username')
            .eq('id', inv.opponent_id)
            .maybeSingle();

          return {
            ...inv,
            challenger_profile: challengerProfile.data,
            opponent_profile: opponentProfile.data,
          };
        })
      );

      setInvitations(invitationsWithProfiles);
    } catch (error) {
      console.error('Error loading invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('challenge_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);

      if (error) throw error;
      toast.success('Challenge angenommen! 🎉');
      loadInvitations();
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast.error('Fehler beim Annehmen');
    }
  };

  const handleDecline = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('challenge_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);

      if (error) throw error;
      toast.success('Challenge abgelehnt');
      loadInvitations();
    } catch (error) {
      console.error('Error declining invitation:', error);
      toast.error('Fehler beim Ablehnen');
    }
  };

  const getStatusBadge = (status: string, isChallenger: boolean) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Warten</Badge>;
      case 'accepted':
        return <Badge className="bg-primary"><Check className="h-3 w-3 mr-1" /> Bereit</Badge>;
      case 'in_progress':
        return <Badge className="bg-orange-500">⚡ Live</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500"><Trophy className="h-3 w-3 mr-1" /> Fertig</Badge>;
      case 'declined':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" /> Abgelehnt</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 animate-pulse bg-muted h-24" />
        ))}
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">Noch keine Challenges</p>
        <p className="text-sm text-muted-foreground mt-1">
          Fordere einen Freund heraus!
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {invitations.map((invitation) => {
        const isChallenger = invitation.challenger_id === userId;
        const opponentName = isChallenger 
          ? invitation.opponent_profile?.username || 'Unbekannt'
          : invitation.challenger_profile?.username || 'Unbekannt';
        return (
          <Card key={invitation.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{invitation.challenge.icon}</span>
                <div>
                  <h4 className="font-semibold">{invitation.challenge.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {isChallenger ? 'vs' : 'von'} {opponentName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(invitation.created_at), 'dd. MMM, HH:mm', { locale: de })}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(invitation.status, isChallenger)}
                
                {invitation.status === 'completed' && (
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="font-bold text-sm">
                      +{invitation.challenge.winner_points}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons for pending invitations (only for opponent) */}
            {invitation.status === 'pending' && !isChallenger && (
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={() => handleAccept(invitation.id)}
                  className="flex-1"
                  size="sm"
                >
                  <Check className="h-4 w-4 mr-1" /> Annehmen
                </Button>
                <Button
                  onClick={() => handleDecline(invitation.id)}
                  variant="outline"
                  size="sm"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Start button for accepted challenges */}
            {invitation.status === 'accepted' && onStartChallenge && (
              <Button
                onClick={() => onStartChallenge(invitation)}
                className="w-full mt-3"
                size="sm"
              >
                ⚡ Challenge starten
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
};
