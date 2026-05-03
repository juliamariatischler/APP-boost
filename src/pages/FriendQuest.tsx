import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Swords, Users, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FriendSearch } from '@/components/FriendSearch';
import { ChallengeSelector } from '@/components/ChallengeSelector';
import { InviteCodeDisplay } from '@/components/InviteCodeDisplay';
import { ChallengeInvitationsList } from '@/components/ChallengeInvitationsList';
import { LiveBattle } from '@/components/LiveBattle';
import { TopHeader } from '@/components/TopHeader';
import { BottomNav } from '@/components/BottomNav';
import friendImg from '@/assets/challenge-friend.jpg';

interface Profile {
  id: string;
  username: string;
  school: string;
  class: string;
}

interface Challenge {
  id: string;
  name: string;
  description: string;
  icon: string;
  winner_points: number;
  loser_points: number;
}

interface ActiveBattle {
  invitationId: string;
  challengeData: {
    name: string;
    icon: string;
    winner_points: number;
    loser_points: number;
  };
  isChallenger: boolean;
  challengerName: string;
  opponentName: string;
}

const FriendQuest = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [activeBattle, setActiveBattle] = useState<ActiveBattle | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUserId(session.user.id);
    
    // Load username
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', session.user.id)
      .maybeSingle();
    
    if (profile) {
      setUsername(profile.username);
    }
  };

  const handleStartBattle = async (invitation: any) => {
    // Load challenge and profile data
    const challengeData = invitation.challenge;
    const isChallenger = invitation.challenger_id === userId;
    
    setActiveBattle({
      invitationId: invitation.id,
      challengeData: {
        name: challengeData.name,
        icon: challengeData.icon,
        winner_points: challengeData.winner_points,
        loser_points: challengeData.loser_points,
      },
      isChallenger,
      challengerName: invitation.challenger_profile?.username || 'Spieler 1',
      opponentName: invitation.opponent_profile?.username || 'Spieler 2',
    });
  };

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const handleCreateChallenge = async () => {
    if (!selectedChallenge || !userId) {
      toast.error('Bitte wähle eine Challenge aus');
      return;
    }

    setIsCreating(true);
    try {
      const code = generateInviteCode();
      
      // Create with a placeholder opponent_id (will be updated when someone joins)
      const { error } = await supabase
        .from('challenge_invitations')
        .insert({
          challenge_id: selectedChallenge.id,
          challenger_id: userId,
          opponent_id: userId, // Temporary, will be updated
          invite_code: code,
          status: 'pending',
        });

      if (error) throw error;
      
      setInviteCode(code);
      toast.success('Challenge erstellt! 🎉');
    } catch (error) {
      console.error('Error creating challenge:', error);
      toast.error('Fehler beim Erstellen');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateDirectChallenge = async () => {
    if (!selectedFriend || !selectedChallenge || !userId) {
      toast.error('Bitte wähle einen Freund und eine Challenge aus');
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await supabase
        .from('challenge_invitations')
        .insert({
          challenge_id: selectedChallenge.id,
          challenger_id: userId,
          opponent_id: selectedFriend.id,
          status: 'pending',
        });

      if (error) throw error;
      
      toast.success(`Challenge an ${selectedFriend.username} gesendet! 🎉`);
      setSelectedFriend(null);
      setSelectedChallenge(null);
    } catch (error) {
      console.error('Error creating challenge:', error);
      toast.error('Fehler beim Erstellen');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinChallenge = async () => {
    if (!joinCode.trim() || !userId) {
      toast.error('Bitte gib einen Code ein');
      return;
    }

    setIsJoining(true);
    try {
      // Find the invitation
      const { data: invitation, error: findError } = await supabase
        .from('challenge_invitations')
        .select('*')
        .eq('invite_code', joinCode.toUpperCase())
        .eq('status', 'pending')
        .maybeSingle();

      if (findError) throw findError;
      if (!invitation) {
        toast.error('Ungültiger oder bereits verwendeter Code');
        return;
      }

      if (invitation.challenger_id === userId) {
        toast.error('Du kannst nicht deiner eigenen Challenge beitreten');
        return;
      }

      // Update the invitation with the opponent
      const { error: updateError } = await supabase
        .from('challenge_invitations')
        .update({
          opponent_id: userId,
          status: 'accepted',
        })
        .eq('id', invitation.id);

      if (updateError) throw updateError;

      toast.success('Challenge beigetreten! 🎉');
      setJoinCode('');
    } catch (error) {
      console.error('Error joining challenge:', error);
      toast.error('Fehler beim Beitreten');
    } finally {
      setIsJoining(false);
    }
  };

  if (!userId) return null;

  // Show Live Battle if active
  if (activeBattle) {
    return (
      <LiveBattle
        invitationId={activeBattle.invitationId}
        challengeData={activeBattle.challengeData}
        userId={userId}
        isChallenger={activeBattle.isChallenger}
        challengerName={activeBattle.challengerName}
        opponentName={activeBattle.opponentName}
        onClose={() => setActiveBattle(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <TopHeader />

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 pb-8">
        <Card className="p-6 bg-card shadow-card">
          <h1 className="text-3xl font-bold mb-4 text-center text-foreground flex items-center justify-center gap-3">
            <Swords className="h-8 w-8" />
            Friendquest Challenge
          </h1>

          <div className="mb-6 rounded-lg overflow-hidden">
            <img
              src={friendImg}
              alt="Friendquest Challenge"
              className="w-full h-auto"
            />
          </div>

          <p className="text-lg text-muted-foreground mb-8 text-center">
            Fordere deine Freunde heraus und habt zusammen Spaß an der Bewegung!
          </p>

          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="create">
                <UserPlus className="h-4 w-4 mr-1" />
                Erstellen
              </TabsTrigger>
              <TabsTrigger value="join">
                <Ticket className="h-4 w-4 mr-1" />
                Beitreten
              </TabsTrigger>
              <TabsTrigger value="challenges">
                <Users className="h-4 w-4 mr-1" />
                Meine
              </TabsTrigger>
            </TabsList>

            {/* Create Challenge Tab */}
            <TabsContent value="create" className="space-y-6 mt-4">
              {inviteCode ? (
                <>
                  <InviteCodeDisplay 
                    inviteCode={inviteCode} 
                    challengeName={selectedChallenge?.name || ''} 
                  />
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setInviteCode(null);
                      setSelectedChallenge(null);
                    }}
                  >
                    Neue Challenge erstellen
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="font-semibold mb-3 text-foreground">1. Freund suchen (optional)</h3>
                    <FriendSearch 
                      currentUserId={userId} 
                      onFriendSelect={setSelectedFriend} 
                    />
                    {selectedFriend && (
                      <Card className="p-3 mt-3 bg-primary/10 border-primary/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{selectedFriend.username}</p>
                            <p className="text-sm text-muted-foreground">
                              {selectedFriend.school} • Klasse {selectedFriend.class}
                            </p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => setSelectedFriend(null)}
                          >
                            ✕
                          </Button>
                        </div>
                      </Card>
                    )}
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3 text-foreground">2. Challenge auswählen</h3>
                    <ChallengeSelector
                      selectedChallenge={selectedChallenge}
                      onChallengeSelect={setSelectedChallenge}
                    />
                  </div>

                  {selectedFriend ? (
                    <Button
                      onClick={handleCreateDirectChallenge}
                      disabled={!selectedChallenge || isCreating}
                      className="w-full"
                      size="lg"
                    >
                      {isCreating ? 'Wird gesendet...' : `${selectedFriend.username} herausfordern 💪`}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleCreateChallenge}
                      disabled={!selectedChallenge || isCreating}
                      className="w-full"
                      size="lg"
                    >
                      {isCreating ? 'Wird erstellt...' : 'Einladungscode erstellen 🎯'}
                    </Button>
                  )}
                </>
              )}
            </TabsContent>

            {/* Join Challenge Tab */}
            <TabsContent value="join" className="space-y-4 mt-4">
              <Card className="p-6 bg-muted/30">
                <h3 className="font-semibold text-center mb-4 text-foreground">Code eingeben</h3>
                <Input
                  placeholder="Z.B. ABC123"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="text-center text-2xl tracking-widest font-bold"
                  maxLength={6}
                />
                <Button
                  onClick={handleJoinChallenge}
                  disabled={joinCode.length < 6 || isJoining}
                  className="w-full mt-4"
                  size="lg"
                >
                  {isJoining ? 'Wird geladen...' : 'Challenge beitreten ⚡'}
                </Button>
              </Card>
            </TabsContent>

            {/* My Challenges Tab */}
            <TabsContent value="challenges" className="mt-4">
              <ChallengeInvitationsList userId={userId} onStartChallenge={handleStartBattle} />
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default FriendQuest;
