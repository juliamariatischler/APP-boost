import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Link,
  Play,
  RefreshCw,
  Send,
  Share2,
  Swords,
  Ticket,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChallengeSelector } from '@/components/ChallengeSelector';
import { LiveBattle } from '@/components/LiveBattle';
import { TopHeader } from '@/components/TopHeader';
import { BottomNav } from '@/components/BottomNav';
import friendImg from '@/assets/quest-friend-emoji.png';

interface Challenge {
  id: string;
  name: string;
  description: string;
  icon: string;
  winner_points: number;
  loser_points: number;
}

interface FriendquestInvite {
  id: string;
  creator_user_id: string;
  invited_user_id: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  challenge_id: string | null;
  challenge_name: string | null;
  creator_name: string;
  invited_name: string | null;
}

interface Friendquest {
  id: string;
  user_a_id: string;
  user_b_id: string;
  friend_name: string;
  status: string;
  selected_challenge_id: string | null;
  challenge_name: string | null;
  challenge_icon: string | null;
  winner_points: number | null;
  loser_points: number | null;
  challenge_invitation_id: string | null;
  created_at: string;
}

interface CreatedInvite {
  invite_id: string;
  invite_code: string;
  expires_at: string;
  challenge_name: string | null;
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

const GENERIC_CODE_ERROR = 'Der Code ist leider ungültig oder abgelaufen.';

const FriendQuest = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [challengeForStart, setChallengeForStart] = useState<Record<string, Challenge | null>>({});
  const [createdInvite, setCreatedInvite] = useState<CreatedInvite | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinStatus, setJoinStatus] = useState<string | null>(null);
  const [invites, setInvites] = useState<FriendquestInvite[]>([]);
  const [friendquests, setFriendquests] = useState<Friendquest[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLoadingMine, setIsLoadingMine] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [busyFriendquestId, setBusyFriendquestId] = useState<string | null>(null);
  const [activeBattle, setActiveBattle] = useState<ActiveBattle | null>(null);

  useEffect(() => {
    void checkAuth();
  }, []);

  useEffect(() => {
    if (!userId) return;
    void loadMine();
  }, [userId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUserId(session.user.id);
  };

  const loadMine = async () => {
    setIsLoadingMine(true);
    try {
      const [{ data: inviteData, error: inviteError }, { data: questData, error: questError }] = await Promise.all([
        (supabase.rpc as any)('get_my_friendquest_invites'),
        (supabase.rpc as any)('get_my_friendquests'),
      ]);

      if (inviteError) throw inviteError;
      if (questError) throw questError;

      setInvites((inviteData || []) as FriendquestInvite[]);
      setFriendquests((questData || []) as Friendquest[]);
    } catch (error) {
      console.error('Friendquest load failed:', error);
      toast.error('Friendquests konnten nicht geladen werden.');
    } finally {
      setIsLoadingMine(false);
    }
  };

  const handleCreateInvite = async () => {
    setIsCreating(true);
    try {
      const { data, error } = await (supabase.rpc as any)('create_friendquest_invite', {
        p_challenge_id: selectedChallenge?.id ?? null,
      });

      if (error) throw error;

      const invite = Array.isArray(data) ? data[0] : data;
      setCreatedInvite(invite as CreatedInvite);
      toast.success('Einladungscode erstellt!');
      await loadMine();
    } catch (error) {
      console.error('Create friendquest invite failed:', error);
      toast.error('Einladung konnte nicht erstellt werden.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!createdInvite?.invite_code) return;

    try {
      await navigator.clipboard.writeText(createdInvite.invite_code);
      toast.success('Code kopiert!');
    } catch {
      toast.error('Code konnte nicht kopiert werden.');
    }
  };

  const handleShareCode = async () => {
    if (!createdInvite?.invite_code) return;

    const text = `Teile diesen BOOST-Code mit deiner Freundin: ${createdInvite.invite_code}. Danach bestätigst du die Anfrage in der App.`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'BOOST Friendquest', text });
        return;
      } catch {
        return;
      }
    }

    await handleCopyCode();
  };

  const handleRedeemCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 8) {
      toast.error('Bitte gib den Einladungscode ein.');
      return;
    }

    setIsJoining(true);
    setJoinStatus(null);

    try {
      const { error } = await (supabase.rpc as any)('redeem_friendquest_invite', {
        p_code: code,
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      if (!result || result.status !== 'awaiting_creator_confirmation') {
        toast.error(GENERIC_CODE_ERROR);
        return;
      }

      setJoinCode('');
      setJoinStatus('Anfrage gesendet. Warte auf Bestätigung.');
      toast.success('Anfrage gesendet!');
      await loadMine();
    } catch (error) {
      console.error('Redeem friendquest invite failed');
      toast.error(GENERIC_CODE_ERROR);
    } finally {
      setIsJoining(false);
    }
  };

  const handleConfirmInvite = async (inviteId: string) => {
    setBusyInviteId(inviteId);
    try {
      const { error } = await (supabase.rpc as any)('confirm_friendquest_invite', {
        p_invite_id: inviteId,
      });

      if (error) throw error;

      toast.success('Bestätigt! Ihr könnt loslegen.');
      await loadMine();
    } catch (error) {
      console.error('Confirm friendquest invite failed:', error);
      toast.error('Die Anfrage konnte nicht bestätigt werden.');
    } finally {
      setBusyInviteId(null);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    setBusyInviteId(inviteId);
    try {
      const { error } = await (supabase.rpc as any)('decline_friendquest_invite', {
        p_invite_id: inviteId,
      });

      if (error) throw error;

      toast.success('Anfrage abgelehnt.');
      await loadMine();
    } catch (error) {
      console.error('Decline friendquest invite failed:', error);
      toast.error('Die Anfrage konnte nicht abgelehnt werden.');
    } finally {
      setBusyInviteId(null);
    }
  };

  const handleStartFriendquest = async (friendquest: Friendquest) => {
    if (friendquest.challenge_invitation_id && friendquest.challenge_name && friendquest.challenge_icon) {
      setActiveBattle({
        invitationId: friendquest.challenge_invitation_id,
        challengeData: {
          name: friendquest.challenge_name,
          icon: friendquest.challenge_icon,
          winner_points: friendquest.winner_points || 50,
          loser_points: friendquest.loser_points || 20,
        },
        isChallenger: true,
        challengerName: 'Du',
        opponentName: friendquest.friend_name,
      });
      return;
    }

    const challenge = challengeForStart[friendquest.id];
    if (!challenge) {
      toast.error('Bitte wähle zuerst eine Challenge aus.');
      return;
    }

    setBusyFriendquestId(friendquest.id);
    try {
      const { data, error } = await (supabase.rpc as any)('start_friendquest_challenge', {
        p_friendquest_id: friendquest.id,
        p_challenge_id: challenge.id,
      });

      if (error) throw error;

      setActiveBattle({
        invitationId: data as string,
        challengeData: {
          name: challenge.name,
          icon: challenge.icon,
          winner_points: challenge.winner_points,
          loser_points: challenge.loser_points,
        },
        isChallenger: true,
        challengerName: 'Du',
        opponentName: friendquest.friend_name,
      });
      await loadMine();
    } catch (error) {
      console.error('Start friendquest challenge failed:', error);
      toast.error('Challenge konnte nicht gestartet werden.');
    } finally {
      setBusyFriendquestId(null);
    }
  };

  const pendingOutgoing = useMemo(
    () => invites.filter((invite) => invite.creator_user_id === userId && invite.status === 'pending'),
    [invites, userId],
  );

  const incomingRequests = useMemo(
    () => invites.filter((invite) => invite.creator_user_id === userId && invite.status === 'awaiting_creator_confirmation'),
    [invites, userId],
  );

  const sentRequests = useMemo(
    () => invites.filter((invite) => invite.invited_user_id === userId && invite.status === 'awaiting_creator_confirmation'),
    [invites, userId],
  );

  if (!userId) return null;

  if (activeBattle) {
    return (
      <LiveBattle
        invitationId={activeBattle.invitationId}
        challengeData={activeBattle.challengeData}
        userId={userId}
        isChallenger={activeBattle.isChallenger}
        challengerName={activeBattle.challengerName}
        opponentName={activeBattle.opponentName}
        onClose={() => {
          setActiveBattle(null);
          void loadMine();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <TopHeader />

      <div className="mx-auto max-w-screen-xl px-4 pb-8">
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-[28px] border border-primary/25 bg-[radial-gradient(circle_at_24%_32%,rgba(139,92,246,0.92)_0%,rgba(14,165,233,0.82)_42%,rgba(34,211,238,0.42)_60%,rgba(220,252,231,0.66)_78%,rgba(255,255,255,0.94)_100%)] text-foreground shadow-[0_20px_42px_rgba(31,224,102,0.14),0_10px_24px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.82)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(104deg,rgba(88,28,135,0.16)_0%,rgba(14,165,233,0.2)_45%,rgba(255,255,255,0.58)_69%,rgba(255,255,255,0.9)_100%)]" />
            <div className="grid grid-cols-[minmax(0,1fr)_140px]">
              <div className="relative min-h-[13.5rem] overflow-hidden">
                <img
                  src={friendImg}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover opacity-75 mix-blend-multiply"
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_34%_28%,rgba(255,255,255,0.36)_0%,transparent_34%),linear-gradient(90deg,rgba(21,28,93,0.18)_0%,rgba(255,255,255,0.1)_72%,rgba(255,255,255,0.6)_100%)]" />
                <div className="absolute left-5 top-5 rounded-full bg-white/18 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur">
                  Team
                </div>
                <div className="absolute bottom-5 left-5 right-6">
                  <h1 className="text-[2rem] font-black leading-none tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.26)]">
                    Friendquest
                  </h1>
                  <p className="mt-2 max-w-[13rem] text-sm font-semibold leading-snug text-white/86">
                    Code teilen, Anfrage bestätigen und gemeinsam starten.
                  </p>
                </div>
              </div>

              <div className="relative flex flex-col items-center justify-center px-2 py-4">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_42%_42%,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.42)_50%,transparent_80%)]" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_14px_30px_rgba(31,224,102,0.22),inset_0_2px_0_rgba(255,255,255,0.36)]">
                  <Swords className="h-10 w-10" />
                </div>
                <p className="relative mt-3 flex items-center gap-1 text-xs font-black text-foreground/70">
                  Sicher einladen
                  <Zap className="h-3.5 w-3.5 fill-warning text-warning" />
                </p>
              </div>
            </div>

            <div className="relative flex items-center gap-2 overflow-x-auto bg-white/66 px-5 py-4 backdrop-blur-[2px]">
              {['Erstellen', 'Beitreten', 'Meine'].map((label) => (
                <span key={label} className="shrink-0 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-black text-foreground shadow-[0_8px_16px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.5)]">
                  {label}
                </span>
              ))}
            </div>
          </div>

          <Card className="overflow-hidden rounded-[24px] border border-black/5 bg-white p-4 shadow-[0_18px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]">
            <Tabs defaultValue="create" className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-3 rounded-[18px] bg-muted/60 p-1">
                <TabsTrigger value="create">
                  <Link className="h-4 w-4 mr-1" />
                  Erstellen
                </TabsTrigger>
                <TabsTrigger value="join">
                  <Ticket className="h-4 w-4 mr-1" />
                  Beitreten
                </TabsTrigger>
                <TabsTrigger value="mine">
                  <Users className="h-4 w-4 mr-1" />
                  Meine
                </TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="space-y-5 mt-4">
                {createdInvite ? (
                  <Card className="overflow-hidden rounded-[22px] border-primary/25 bg-primary/5 p-5 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Ticket className="h-6 w-6" />
                    </div>
                    <h3 className="mt-3 text-lg font-black text-foreground">Teile diesen Code</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Deine Freundin gibt den Code bei sich ein. Danach bestätigst du die Anfrage.
                    </p>
                    <div className="mt-4 rounded-2xl bg-white px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                      <p className="font-mono text-3xl font-black tracking-[0.22em] text-primary">
                        {createdInvite.invite_code}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Gültig bis {new Date(createdInvite.expires_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {createdInvite.challenge_name && (
                      <Badge className="mt-3" variant="secondary">
                        {createdInvite.challenge_name}
                      </Badge>
                    )}
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <Button onClick={handleCopyCode} variant="outline">
                        <Copy className="mr-2 h-4 w-4" />
                        Kopieren
                      </Button>
                      <Button onClick={handleShareCode}>
                        <Share2 className="mr-2 h-4 w-4" />
                        Teilen
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      className="mt-3 w-full"
                      onClick={() => {
                        setCreatedInvite(null);
                        setSelectedChallenge(null);
                      }}
                    >
                      Neue Einladung
                    </Button>
                  </Card>
                ) : (
                  <>
                    <Card className="rounded-[22px] bg-muted/25 p-4">
                      <h3 className="font-black text-foreground">Challenge optional auswählen</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Du kannst auch erst den Code teilen und die Challenge später starten.
                      </p>
                    </Card>
                    <ChallengeSelector
                      selectedChallenge={selectedChallenge}
                      onChallengeSelect={setSelectedChallenge}
                    />
                    <Button
                      onClick={handleCreateInvite}
                      disabled={isCreating}
                      className="w-full"
                      size="lg"
                    >
                      {isCreating ? 'Code wird erstellt...' : 'Einladungscode erstellen'}
                      <Send className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )}
              </TabsContent>

              <TabsContent value="join" className="space-y-4 mt-4">
                <Card className="rounded-[22px] bg-muted/30 p-6">
                  <h3 className="font-black text-center text-foreground">Code eingeben</h3>
                  <p className="mx-auto mt-1 max-w-xs text-center text-sm text-muted-foreground">
                    Gib den Code ein. Die andere Person bestätigt danach deine Anfrage.
                  </p>
                  <Input
                    placeholder="Z.B. A1B2C3D4"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    className="mt-4 text-center text-2xl tracking-widest font-bold"
                    maxLength={24}
                    autoCapitalize="characters"
                  />
                  <Button
                    onClick={handleRedeemCode}
                    disabled={joinCode.length < 8 || isJoining}
                    className="w-full mt-4"
                    size="lg"
                  >
                    {isJoining ? 'Anfrage wird gesendet...' : 'Anfrage senden'}
                  </Button>
                </Card>
                {joinStatus && (
                  <Card className="flex items-center gap-3 rounded-[20px] border-primary/20 bg-primary/5 p-4 text-sm font-semibold text-foreground">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    {joinStatus}
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="mine" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-foreground">Meine Friendquests</h3>
                  <Button variant="ghost" size="sm" onClick={() => void loadMine()} disabled={isLoadingMine}>
                    <RefreshCw className={`h-4 w-4 ${isLoadingMine ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                {incomingRequests.length > 0 && (
                  <section className="space-y-3">
                    <p className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">Anfragen</p>
                    {incomingRequests.map((invite) => (
                      <Card key={invite.id} className="rounded-[22px] border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-foreground">Anfrage von {invite.invited_name || 'einem Freund'}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Möchte deiner Friendquest beitreten.
                            </p>
                            {invite.challenge_name && (
                              <Badge variant="secondary" className="mt-2">{invite.challenge_name}</Badge>
                            )}
                          </div>
                          <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Button
                            onClick={() => void handleConfirmInvite(invite.id)}
                            disabled={busyInviteId === invite.id}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Bestätigen
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => void handleDeclineInvite(invite.id)}
                            disabled={busyInviteId === invite.id}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Ablehnen
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </section>
                )}

                {sentRequests.length > 0 && (
                  <section className="space-y-3">
                    <p className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">Gesendet</p>
                    {sentRequests.map((invite) => (
                      <Card key={invite.id} className="flex items-center gap-3 rounded-[20px] p-4">
                        <Clock className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-semibold text-foreground">Anfrage gesendet</p>
                          <p className="text-sm text-muted-foreground">
                            Warte auf {invite.creator_name}.
                          </p>
                        </div>
                      </Card>
                    ))}
                  </section>
                )}

                {pendingOutgoing.length > 0 && (
                  <section className="space-y-3">
                    <p className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">Offene Codes</p>
                    {pendingOutgoing.map((invite) => (
                      <Card key={invite.id} className="rounded-[20px] p-4">
                        <div className="flex items-center gap-3">
                          <Ticket className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-semibold text-foreground">Code wartet auf Eingabe</p>
                            <p className="text-sm text-muted-foreground">
                              Gültig bis {new Date(invite.expires_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </section>
                )}

                <section className="space-y-3">
                  <p className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">Aktiv</p>
                  {friendquests.length === 0 ? (
                    <Card className="rounded-[22px] p-6 text-center">
                      <p className="font-semibold text-foreground">Noch keine aktive Friendquest</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Erstelle einen Code oder gib einen Code ein.
                      </p>
                    </Card>
                  ) : (
                    friendquests.map((friendquest) => (
                      <Card key={friendquest.id} className="rounded-[22px] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-foreground">Mit {friendquest.friend_name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Jetzt könnt ihr gemeinsam eine Challenge starten.
                            </p>
                            {friendquest.challenge_name && (
                              <Badge className="mt-2" variant="secondary">
                                {friendquest.challenge_icon} {friendquest.challenge_name}
                              </Badge>
                            )}
                          </div>
                          <Swords className="h-5 w-5 text-primary" />
                        </div>

                        {!friendquest.challenge_invitation_id && (
                          <div className="mt-4">
                            <p className="mb-3 text-sm font-semibold text-foreground">Challenge auswählen</p>
                            <ChallengeSelector
                              selectedChallenge={challengeForStart[friendquest.id] || null}
                              onChallengeSelect={(challenge) => {
                                setChallengeForStart((prev) => ({ ...prev, [friendquest.id]: challenge }));
                              }}
                            />
                          </div>
                        )}

                        <Button
                          className="mt-4 w-full"
                          onClick={() => void handleStartFriendquest(friendquest)}
                          disabled={busyFriendquestId === friendquest.id}
                        >
                          <Play className="mr-2 h-4 w-4 fill-current" />
                          Battle starten
                        </Button>
                      </Card>
                    ))
                  )}
                </section>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default FriendQuest;
