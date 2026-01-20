import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Zap, Trophy, Clock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import boostLogo from '@/assets/boost-logo.png';

interface Challenge {
  name: string;
  icon: string;
  winner_points: number;
  loser_points: number;
}

interface LiveBattleProps {
  invitationId: string;
  challengeData: Challenge;
  userId: string;
  isChallenger: boolean;
  challengerName: string;
  opponentName: string;
  onClose: () => void;
}

type BattlePhase = 'waiting' | 'countdown' | 'battle' | 'submitting' | 'completed';

export const LiveBattle = ({
  invitationId,
  challengeData,
  userId,
  isChallenger,
  challengerName,
  opponentName,
  onClose,
}: LiveBattleProps) => {
  const [phase, setPhase] = useState<BattlePhase>('waiting');
  const [countdown, setCountdown] = useState(3);
  const [battleTime, setBattleTime] = useState(60);
  const [myResult, setMyResult] = useState(0);
  const [opponentResult, setOpponentResult] = useState(0);
  const [opponentReady, setOpponentReady] = useState(false);
  const [myReady, setMyReady] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [challengerId, setChallengerId] = useState<string>('');
  const [opponentId, setOpponentId] = useState<string>('');

  // Load initial data
  useEffect(() => {
    loadBattleData();
  }, [invitationId]);

  const loadBattleData = async () => {
    const { data, error } = await supabase
      .from('challenge_invitations')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (error || !data) {
      toast.error('Battle nicht gefunden');
      onClose();
      return;
    }

    setChallengerId(data.challenger_id);
    setOpponentId(data.opponent_id);
    setMyReady(isChallenger ? data.challenger_ready || false : data.opponent_ready || false);
    setOpponentReady(isChallenger ? data.opponent_ready || false : data.challenger_ready || false);
    
    if (data.challenger_result !== null) {
      if (isChallenger) {
        setMyResult(data.challenger_result);
      } else {
        setOpponentResult(data.challenger_result);
      }
    }
    
    if (data.opponent_result !== null) {
      if (!isChallenger) {
        setMyResult(data.opponent_result);
      } else {
        setOpponentResult(data.opponent_result);
      }
    }

    if (data.status === 'completed') {
      setPhase('completed');
      setWinnerId(data.winner_id);
    } else if (data.status === 'in_progress') {
      setPhase('battle');
    }
  };

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`battle-${invitationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'challenge_invitations',
          filter: `id=eq.${invitationId}`,
        },
        (payload) => {
          const data = payload.new as any;
          
          // Update ready states
          if (isChallenger) {
            setOpponentReady(data.opponent_ready || false);
            if (data.opponent_result !== null) {
              setOpponentResult(data.opponent_result);
            }
          } else {
            setOpponentReady(data.challenger_ready || false);
            if (data.challenger_result !== null) {
              setOpponentResult(data.challenger_result);
            }
          }

          // Check if battle started
          if (data.battle_started_at && phase === 'waiting') {
            startCountdown();
          }

          // Check if completed
          if (data.status === 'completed') {
            setPhase('completed');
            setWinnerId(data.winner_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [invitationId, isChallenger, phase]);

  // Check if both ready and start countdown
  useEffect(() => {
    if (myReady && opponentReady && phase === 'waiting') {
      startBattle();
    }
  }, [myReady, opponentReady, phase]);

  const startCountdown = () => {
    setPhase('countdown');
    setCountdown(3);
  };

  // Countdown timer
  useEffect(() => {
    if (phase !== 'countdown') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPhase('battle');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  // Battle timer
  useEffect(() => {
    if (phase !== 'battle') return;

    const timer = setInterval(() => {
      setBattleTime((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          submitResult();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  const handleReady = async () => {
    const updateField = isChallenger ? 'challenger_ready' : 'opponent_ready';
    
    const { error } = await supabase
      .from('challenge_invitations')
      .update({ 
        [updateField]: true,
        status: 'in_progress',
      })
      .eq('id', invitationId);

    if (error) {
      toast.error('Fehler beim Bereitwerden');
      return;
    }

    setMyReady(true);
  };

  const startBattle = async () => {
    // Only challenger triggers the battle start
    if (isChallenger) {
      await supabase
        .from('challenge_invitations')
        .update({ 
          battle_started_at: new Date().toISOString(),
          status: 'in_progress',
        })
        .eq('id', invitationId);
    }
    startCountdown();
  };

  const incrementResult = () => {
    if (phase === 'battle') {
      setMyResult((prev) => prev + 1);
    }
  };

  const submitResult = async () => {
    setPhase('submitting');
    
    const resultField = isChallenger ? 'challenger_result' : 'opponent_result';
    
    const { error } = await supabase
      .from('challenge_invitations')
      .update({ [resultField]: myResult })
      .eq('id', invitationId);

    if (error) {
      toast.error('Fehler beim Speichern');
      return;
    }

    // Check if both results are in
    const { data } = await supabase
      .from('challenge_invitations')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (data?.challenger_result !== null && data?.opponent_result !== null) {
      // Determine winner
      const winner = data.challenger_result > data.opponent_result 
        ? data.challenger_id 
        : data.opponent_result > data.challenger_result 
          ? data.opponent_id 
          : null; // Tie

      await supabase
        .from('challenge_invitations')
        .update({ 
          status: 'completed',
          winner_id: winner,
          completed_at: new Date().toISOString(),
        })
        .eq('id', invitationId);

      // Award points using the increment_points function
      if (winner) {
        const loserId = winner === data.challenger_id ? data.opponent_id : data.challenger_id;
        
        // Update winner points - use type assertion for the new function
        try {
          await (supabase.rpc as any)('increment_points', { 
            user_id_param: winner, 
            points_to_add: challengeData.winner_points 
          });
        } catch (e) {
          console.error('Error updating winner points:', e);
        }

        // Update loser points
        try {
          await (supabase.rpc as any)('increment_points', { 
            user_id_param: loserId, 
            points_to_add: challengeData.loser_points 
          });
        } catch (e) {
          console.error('Error updating loser points:', e);
        }
      }

      setPhase('completed');
      setWinnerId(winner);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isWinner = winnerId === userId;
  const isTie = winnerId === null && phase === 'completed';

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <img src={boostLogo} alt="BOOST" className="h-8" />
          <div className="w-10" />
        </div>
      </div>

      {/* Battle Arena */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-6">
        {/* Challenge Info */}
        <div className="text-center">
          <span className="text-5xl">{challengeData.icon}</span>
          <h2 className="text-2xl font-bold mt-2">{challengeData.name}</h2>
        </div>

        {/* Waiting Phase */}
        {phase === 'waiting' && (
          <Card className="p-6 w-full max-w-md text-center space-y-4">
            <h3 className="text-xl font-semibold">Bereit machen!</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${myReady ? 'bg-green-500' : 'bg-muted'}`}>
                  <User className="h-8 w-8 text-white" />
                </div>
                <p className="mt-2 font-medium">Du</p>
                <Badge variant={myReady ? 'default' : 'secondary'}>
                  {myReady ? '✓ Bereit' : 'Warten...'}
                </Badge>
              </div>
              
              <div className="text-center">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${opponentReady ? 'bg-green-500' : 'bg-muted'}`}>
                  <User className="h-8 w-8 text-white" />
                </div>
                <p className="mt-2 font-medium">{isChallenger ? opponentName : challengerName}</p>
                <Badge variant={opponentReady ? 'default' : 'secondary'}>
                  {opponentReady ? '✓ Bereit' : 'Warten...'}
                </Badge>
              </div>
            </div>

            {!myReady && (
              <Button onClick={handleReady} size="lg" className="w-full">
                Ich bin bereit! 💪
              </Button>
            )}

            {myReady && !opponentReady && (
              <p className="text-muted-foreground animate-pulse">
                Warte auf deinen Gegner...
              </p>
            )}
          </Card>
        )}

        {/* Countdown Phase */}
        <AnimatePresence>
          {phase === 'countdown' && (
            <motion.div
              key="countdown"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="text-center"
            >
              <motion.span
                key={countdown}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="text-9xl font-bold text-primary"
              >
                {countdown === 0 ? 'LOS!' : countdown}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Battle Phase */}
        {phase === 'battle' && (
          <div className="w-full max-w-md space-y-6">
            {/* Timer */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-2 rounded-full">
                <Clock className="h-5 w-5" />
                <span className="text-2xl font-bold font-mono">{formatTime(battleTime)}</span>
              </div>
            </div>

            {/* Score Display */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 text-center bg-primary/10 border-primary">
                <p className="text-sm text-muted-foreground">Du</p>
                <p className="text-4xl font-bold text-primary">{myResult}</p>
              </Card>
              
              <Card className="p-4 text-center">
                <p className="text-sm text-muted-foreground">{isChallenger ? opponentName : challengerName}</p>
                <p className="text-4xl font-bold">{opponentResult}</p>
              </Card>
            </div>

            {/* Tap Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={incrementResult}
              className="w-full h-40 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-3xl font-bold shadow-lg active:shadow-md transition-shadow"
            >
              TAP! 👆
              <br />
              <span className="text-lg font-normal opacity-80">Tippe für jeden Rep</span>
            </motion.button>

            {/* Submit Early */}
            <Button 
              variant="outline" 
              className="w-full"
              onClick={submitResult}
            >
              Fertig! Ergebnis abschicken
            </Button>
          </div>
        )}

        {/* Submitting Phase */}
        {phase === 'submitting' && (
          <Card className="p-6 text-center">
            <div className="animate-pulse">
              <p className="text-xl font-semibold">Ergebnis wird gespeichert...</p>
              <p className="text-muted-foreground mt-2">Warte auf deinen Gegner</p>
            </div>
          </Card>
        )}

        {/* Completed Phase */}
        {phase === 'completed' && (
          <Card className="p-6 w-full max-w-md text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
            >
              {isTie ? (
                <span className="text-6xl">🤝</span>
              ) : isWinner ? (
                <span className="text-6xl">🏆</span>
              ) : (
                <span className="text-6xl">💪</span>
              )}
            </motion.div>

            <h3 className="text-2xl font-bold">
              {isTie ? 'Unentschieden!' : isWinner ? 'Du hast gewonnen!' : 'Knapp verloren!'}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Du</p>
                <p className="text-3xl font-bold">{myResult}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{isChallenger ? opponentName : challengerName}</p>
                <p className="text-3xl font-bold">{opponentResult}</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-lg">
              <Zap className="h-6 w-6 text-yellow-500" />
              <span className="font-bold">
                +{isTie ? challengeData.loser_points : isWinner ? challengeData.winner_points : challengeData.loser_points} Blitze
              </span>
            </div>

            <Button onClick={onClose} className="w-full" size="lg">
              Zurück
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};
