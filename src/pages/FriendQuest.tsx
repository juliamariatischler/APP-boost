import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { buildCameraUrl, CHALLENGE_CAMERA } from '@/lib/friendQuestChallenges';
import { useNavigate } from 'react-router-dom';
import { useCodeAuth } from '@/contexts/CodeAuthContext';
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
import { BottomNav } from '@/components/BottomNav';
import friendQuestImg from '@/assets/friendquest1.svg';
import { BOOST_POINT_RULES } from '@/lib/gamification';

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

interface CameraResult {
  invitationId: string;
  myResult: number;
  opponentResult: number | null;
  winnerId: string | null;
  status: 'submitting' | 'waiting' | 'done';
}

const GENERIC_CODE_ERROR = 'Der Code ist leider ungültig oder abgelaufen.';

const FriendQuest = () => {
  const navigate = useNavigate();
  const { session: codeSession, loading: codeAuthLoading } = useCodeAuth();
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
  const [cameraResult, setCameraResult] = useState<CameraResult | null>(null);

  useEffect(() => {
    if (codeAuthLoading) return;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (codeSession?.user_type === 'student') {
          setUserId(codeSession.user_id);
          return;
        }
        navigate('/auth');
        return;
      }
      setUserId(session.user.id);
    })();
  }, [navigate, codeSession, codeAuthLoading]);

  useEffect(() => {
    if (!userId) return;
    void loadMine();
    void checkCameraResult(userId);
  }, [userId]);

  const checkCameraResult = async (uid: string) => {
    const raw = localStorage.getItem('fq_battle_result');
    if (!raw) return;
    localStorage.removeItem('fq_battle_result');

    let parsed: { invitation_id: string; result: number } | null = null;
    try { parsed = JSON.parse(raw); } catch { return; }
    if (!parsed?.invitation_id) return;

    const invitationId = parsed.invitation_id;
    const myResult = parsed.result;

    setCameraResult({ invitationId, myResult, opponentResult: null, winnerId: null, status: 'submitting' });

    const { error } = await (supabase.rpc as any)('submit_friendquest_battle_result', {
      p_invitation_id: invitationId,
      p_result: myResult,
    });

    if (error) {
      toast.error('Ergebnis konnte nicht gespeichert werden.');
      setCameraResult(null);
      return;
    }

    const { data } = await supabase
      .from('challenge_invitations')
      .select('challenger_result,opponent_result,winner_id,challenger_id,status')
      .eq('id', invitationId)
      .single();

    const bothDone = data?.challenger_result !== null && data?.opponent_result !== null;
    const opponentResult = bothDone
      ? (data.challenger_id === uid ? data.opponent_result : data.challenger_result)
      : null;

    setCameraResult({
      invitationId,
      myResult,
      opponentResult,
      winnerId: data?.winner_id ?? null,
      status: bothDone ? 'done' : 'waiting',
    });

    if (!bothDone) {
      const channel = supabase
        .channel(`fq-camera-result-${invitationId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'challenge_invitations', filter: `id=eq.${invitationId}` }, (payload) => {
          const d = payload.new as any;
          if (d.challenger_result !== null && d.opponent_result !== null) {
            const oppRes = d.challenger_id === uid ? d.opponent_result : d.challenger_result;
            setCameraResult((prev) => prev ? { ...prev, opponentResult: oppRes, winnerId: d.winner_id, status: 'done' } : null);
            supabase.removeChannel(channel);
          }
        })
        .subscribe();
    }
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
      const message = error instanceof Error ? error.message : String((error as any)?.message || '');
      if (message.toLowerCase().includes('too many active invites')) {
        toast.error('Du hast bereits mehrere offene Einladungen. Warte kurz, bis alte Codes ablaufen.');
      } else if (message.toLowerCase().includes('unauthorized')) {
        toast.error('Bitte melde dich neu an, um einen Einladungscode zu erstellen.');
      } else {
        toast.error(message ? `Einladung konnte nicht erstellt werden: ${message}` : 'Einladung konnte nicht erstellt werden.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!createdInvite?.invite_code) return;

    try {
      await navigator.clipboard.writeText(createdInvite.invite_code);
      toast.success('Code kopiert!', { duration: 3000 });
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
      const { data, error } = await (supabase.rpc as any)('redeem_friendquest_invite', {
        p_code: code,
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      if (!result || result.status !== 'awaiting_creator_confirmation') {
        if (result?.status === 'already_connected') {
          toast.error('Ihr seid bereits miteinander verbunden.');
        } else {
          toast.error(GENERIC_CODE_ERROR);
        }
        return;
      }

      setJoinCode('');
      setJoinStatus('Anfrage gesendet. Warte auf Bestätigung.');
      toast.success('Anfrage gesendet!');
      await loadMine();
    } catch (error) {
      console.error('Redeem friendquest invite failed:', error);
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
    // Already has an active challenge invitation → navigate directly to camera (or LiveBattle fallback)
    if (friendquest.challenge_invitation_id && friendquest.challenge_name) {
      const url = buildCameraUrl(friendquest.challenge_name, friendquest.challenge_invitation_id);
      if (url) {
        window.location.href = url;
        return;
      }
      // Non-camera challenge: fall back to LiveBattle
      if (friendquest.challenge_icon) {
        setActiveBattle({
          invitationId: friendquest.challenge_invitation_id,
          challengeData: {
            name: friendquest.challenge_name,
            icon: friendquest.challenge_icon,
            winner_points: BOOST_POINT_RULES.friendQuestCompleted,
            loser_points: BOOST_POINT_RULES.friendQuestCompleted,
          },
          isChallenger: true,
          challengerName: 'Du',
          opponentName: friendquest.friend_name,
        });
      }
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

      const invitationId = data as string;
      const url = buildCameraUrl(challenge.name, invitationId);
      if (url) {
        window.location.href = url;
        return;
      }
      // Non-camera challenge: fall back to LiveBattle
      setActiveBattle({
        invitationId,
        challengeData: {
          name: challenge.name,
          icon: challenge.icon,
          winner_points: BOOST_POINT_RULES.friendQuestCompleted,
          loser_points: BOOST_POINT_RULES.friendQuestCompleted,
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

  if (cameraResult) {
    const isWinner = cameraResult.winnerId === userId;
    const isTie = cameraResult.status === 'done' && cameraResult.winnerId === null;
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center p-6 gap-6">
        {cameraResult.status === 'submitting' && (
          <Card className="p-8 text-center space-y-3 w-full max-w-sm">
            <div className="animate-pulse text-4xl">⏳</div>
            <p className="text-lg font-black">Ergebnis wird gespeichert…</p>
          </Card>
        )}
        {cameraResult.status === 'waiting' && (
          <Card className="p-8 text-center space-y-4 w-full max-w-sm">
            <div className="text-5xl">💪</div>
            <p className="text-xl font-black">Du: {cameraResult.myResult}</p>
            <p className="text-sm text-muted-foreground animate-pulse">Warte auf das Ergebnis deines Gegners…</p>
          </Card>
        )}
        {cameraResult.status === 'done' && (
          <Card className="p-8 text-center space-y-4 w-full max-w-sm">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
              <span className="text-6xl">{isTie ? '🤝' : isWinner ? '🏆' : '💪'}</span>
            </motion.div>
            <h3 className="text-2xl font-bold">
              {isTie ? 'Unentschieden!' : isWinner ? 'Du hast gewonnen!' : 'Stark mitgemacht!'}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Du</p>
                <p className="text-3xl font-bold">{cameraResult.myResult}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Gegner</p>
                <p className="text-3xl font-bold">{cameraResult.opponentResult ?? '–'}</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-lg">
              <Zap className="h-6 w-6 text-yellow-500" />
              <span className="font-bold">+{BOOST_POINT_RULES.friendQuestCompleted} Blitze gutgeschrieben!</span>
            </div>
            <Button className="w-full" size="lg" onClick={() => { setCameraResult(null); void loadMine(); }}>
              Zurück
            </Button>
          </Card>
        )}
      </div>
    );
  }

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
      <div className="mx-auto max-w-screen-xl px-4 pb-8 pt-3">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_18px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="grid min-h-[13.5rem] grid-cols-[minmax(0,1fr)_46%] overflow-hidden bg-[#f6fbf2]">
              <div className="flex flex-col justify-center gap-3 px-5 py-6">
                <span className="w-fit rounded-full bg-primary/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                  Team
                </span>
                <h1 className="text-[2rem] font-black leading-[0.92] tracking-tight text-foreground">
                  Friendquest
                </h1>
                <p className="max-w-[13rem] text-sm leading-snug text-muted-foreground">
                  Code teilen, Anfrage bestätigen und gemeinsam starten.
                </p>
              </div>
              <div className="flex items-end justify-center overflow-hidden">
                <img
                  src={friendQuestImg}
                  alt=""
                  aria-hidden="true"
                  className="w-full object-contain object-bottom mix-blend-multiply"
                />
              </div>
            </div>
          </div>

          <Card className="overflow-hidden rounded-[24px] border border-black/5 bg-white p-4 shadow-[0_18px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]">
            <Tabs defaultValue="create" className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-3 rounded-[18px] border border-primary/25 bg-primary/8 p-1">
                <TabsTrigger
                  value="create"
                  className="rounded-[14px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_4px_12px_rgba(34,197,94,0.30)]"
                >
                  <Link className="h-4 w-4 mr-1" />
                  Erstellen
                </TabsTrigger>
                <TabsTrigger
                  value="join"
                  className="rounded-[14px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_4px_12px_rgba(34,197,94,0.30)]"
                >
                  <Ticket className="h-4 w-4 mr-1" />
                  Beitreten
                </TabsTrigger>
                <TabsTrigger
                  value="mine"
                  className="rounded-[14px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_4px_12px_rgba(34,197,94,0.30)]"
                >
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
                      Gültig bis {new Date(createdInvite.expires_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Der Code läuft nach 24 Stunden ab.
                    </p>
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
                              Gültig bis {new Date(invite.expires_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · läuft nach 24 h ab
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
