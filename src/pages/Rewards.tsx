import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { Zap, Lock, CheckCircle, Users, User, Calendar, Swords, MapPin, X, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BottomNav } from "@/components/BottomNav";
import { TopHeader } from "@/components/TopHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getDemoAwarePoints } from "@/lib/demo";
import { BOOST_POINT_RULES } from "@/lib/gamification";

type RewardItem = {
  id: string;
  title: string;
  partner: string | null;
  threshold: number;
  category: string;
  icon: string | null;
  image_url: string | null;
  sponsor_logo_url: string | null;
};

type ClassMilestone = {
  id: string;
  threshold: number;
  title: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
};

const fallbackRewards: RewardItem[] = [
  { id: "fallback-muripark-800", title: "Stofftasche groß",  partner: "Murpark", threshold: 800, category: "taschen", icon: "👜",  image_url: null, sponsor_logo_url: null },
  { id: "fallback-muripark-700", title: "Beachtennis-Set",   partner: "Murpark", threshold: 700, category: "sport",   icon: "🏓",  image_url: null, sponsor_logo_url: null },
  { id: "fallback-muripark-600", title: "Frisbee",           partner: "Murpark", threshold: 600, category: "sport",   icon: "🥏",  image_url: null, sponsor_logo_url: null },
  { id: "fallback-muripark-500", title: "Notizbuch",         partner: "Murpark", threshold: 500, category: "kreativ", icon: "📓",  image_url: null, sponsor_logo_url: null },
  { id: "fallback-muripark-400", title: "Stoffbeutel",       partner: "Murpark", threshold: 400, category: "taschen", icon: "🛍️", image_url: null, sponsor_logo_url: null },
  { id: "fallback-muripark-300", title: "Kompaktspiegel",    partner: "Murpark", threshold: 300, category: "style",   icon: "🪞",  image_url: null, sponsor_logo_url: null },
  { id: "fallback-muripark-200", title: "Buntstifte",        partner: "Murpark", threshold: 200, category: "kreativ", icon: "🖍️", image_url: null, sponsor_logo_url: null },
  { id: "fallback-muripark-100", title: "Malset",            partner: "Murpark", threshold: 100, category: "kreativ", icon: "🎨",  image_url: null, sponsor_logo_url: null },
];

const fallbackMilestones: ClassMilestone[] = [
  {
    id: "fallback-class-pausenset",
    threshold: 3000,
    title: "Klassenpausenset",
    description: "Sportgeräte und Spielmaterial für die Pause – für eure ganze Klasse!",
    icon: "🏃",
    sort_order: 1,
  },
];

const Rewards = () => {
  const navigate = useNavigate();
  const { session: codeSession, loading: codeAuthLoading } = useCodeAuth();
  const [activeCategory, setActiveCategory] = useState("alle");
  const [myFlashes, setMyFlashes] = useState(0);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [classFlashes, setClassFlashes] = useState(0);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [milestones, setMilestones] = useState<ClassMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);

  useEffect(() => {
    void loadRewardsData();
  }, [codeSession, codeAuthLoading]);

  const loadRewardsData = async () => {
    if (codeAuthLoading) return;
    setLoading(true);

    if (codeSession?.user_type === "student") {
        setUserId(codeSession.user_id);
        setMyFlashes(codeSession.points ?? 0);
        const [{ data: rewardRows, error: rewardsError }, { data: milestoneRows, error: milestonesError }, { data: rankingsData }] =
          await Promise.all([
            (supabase as any)
              .from("reward_items")
              .select("id, title, partner, threshold, category, icon, image_url, sponsor_logo_url")
              .eq("is_active", true)
              .order("threshold", { ascending: false }),
            (supabase as any)
              .from("class_milestones")
              .select("id, threshold, title, description, icon, sort_order")
              .eq("is_active", true)
              .order("sort_order", { ascending: true })
              .order("threshold", { ascending: true }),
            (supabase.rpc as any)("get_code_class_student_rankings", {
              p_device_id: codeSession.device_id,
              p_session_token: codeSession.session_token,
            }),
          ]);
        setRewards(rewardsError ? fallbackRewards : (((rewardRows || []) as RewardItem[]).filter((r) => r.threshold > 0).length > 0 ? ((rewardRows || []) as RewardItem[]).filter((r) => r.threshold > 0) : fallbackRewards));
        setMilestones(milestonesError ? fallbackMilestones : (((milestoneRows || []) as ClassMilestone[]).filter((m) => m.threshold > 0).length > 0 ? ((milestoneRows || []) as ClassMilestone[]).filter((m) => m.threshold > 0) : fallbackMilestones));
        const rankings = Array.isArray(rankingsData) ? rankingsData : [];
        const myRankIdx = rankings.findIndex((r: { id: string }) => r.id === codeSession.user_id);
        setMyRank(myRankIdx >= 0 ? myRankIdx + 1 : null);
        setLoading(false);
        return;
      }
    // Supabase-auth fallback
    const { data: authData } = await supabase.auth.getSession();
    const uid = authData.session?.user?.id;
    const email = authData.session?.user?.email;
    if (!uid) { navigate("/auth"); return; }
    setUserId(uid);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("points, school, class")
      .eq("id", uid)
      .single();

    if (profileError || !profile) {
      toast.error("Profil konnte nicht geladen werden.");
      setLoading(false);
      return;
    }

    setMyFlashes(getDemoAwarePoints(profile.points, email));

    const [{ data: rewardRows, error: rewardsError }, { data: milestoneRows, error: milestonesError }, { data: classPoints, error: classPointsError }, { data: rankingsData }] =
      await Promise.all([
        (supabase as any)
          .from("reward_items")
          .select("id, title, partner, threshold, category, icon, image_url, sponsor_logo_url")
          .eq("is_active", true)
          .order("threshold", { ascending: false }),
        (supabase as any)
          .from("class_milestones")
          .select("id, threshold, title, description, icon, sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("threshold", { ascending: true }),
        (supabase.rpc as any)("get_class_total_points", { p_school: profile.school, p_class: profile.class }),
        (supabase.rpc as any)("get_my_class_student_rankings"),
      ]);

    if (rewardsError) {
      console.error(rewardsError);
      setRewards(fallbackRewards);
    } else {
      const nextRewards = ((rewardRows || []) as RewardItem[]).filter((reward) => reward.threshold > 0);
      setRewards(nextRewards.length > 0 ? nextRewards : fallbackRewards);
    }

    if (milestonesError) {
      console.error(milestonesError);
      setMilestones(fallbackMilestones);
    } else {
      const nextMilestones = ((milestoneRows || []) as ClassMilestone[]).filter((milestone) => milestone.threshold > 0);
      setMilestones(nextMilestones.length > 0 ? nextMilestones : fallbackMilestones);
    }

    if (classPointsError) {
      console.error(classPointsError);
      setClassFlashes(0);
    } else {
      setClassFlashes(Number(classPoints || 0));
    }

    const rankings = Array.isArray(rankingsData) ? rankingsData : [];
    const myRankIdx = rankings.findIndex((r: { id: string }) => r.id === uid);
    setMyRank(myRankIdx >= 0 ? myRankIdx + 1 : null);

    setLoading(false);
  };

  const handleRedeem = async (rewardId: string) => {
    if (!userId) return;

    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session) {
      toast.error("Belohnungen können nur mit einem vollständigen Konto angefordert werden.");
      return;
    }

    setRedeemingId(rewardId);

    const { error } = await (supabase.rpc as any)("request_reward_redemption", {
      p_reward_id: rewardId,
    });

    setRedeemingId(null);

    if (error) {
      console.error(error);
      toast.error("Belohnung konnte nicht angefordert werden.");
      return;
    }

    toast.success("Belohnung angefordert. Lehrkraft prüft die Freigabe.");
  };

  const categories = useMemo(() => {
    const categorySet = new Set(rewards.map((r) => r.category).filter(Boolean));
    return [{ id: "alle", label: "Alle" }, ...Array.from(categorySet).sort((a, b) => a.localeCompare(b, "de")).map((c) => ({ id: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))];
  }, [rewards]);

  const filteredRewards = activeCategory === "alle" 
    ? rewards
    : rewards.filter(r => r.category === activeCategory);

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <TopHeader />

      <div className="relative max-w-screen-xl mx-auto px-4 -mt-4">
        {/* Coming soon overlay – automatically hidden from 08.06.2026 onwards */}
        {new Date() < new Date("2026-06-08") && (
          <div className="pointer-events-none absolute inset-x-4 top-0 bottom-0 z-30 flex items-start justify-center pt-24 rounded-[28px] bg-[#f5f5f5]/50 dark:bg-zinc-900/50">
            <div className="rotate-[-7deg] text-center">
              <p className="text-[3.8rem] font-black leading-none tracking-tight text-zinc-500/80 dark:text-zinc-400/80 drop-shadow-sm sm:text-[5.5rem]">
                Coming
              </p>
              <p className="mt-2 text-[3.8rem] font-black leading-none tracking-tight text-zinc-500/80 dark:text-zinc-400/80 drop-shadow-sm sm:text-[5.5rem]">
                soon
              </p>
              <p className="mt-3 text-xl font-bold text-zinc-400/80 dark:text-zinc-500/80 tracking-widest">08.06</p>
            </div>
          </div>
        )}

        {/* Title */}
        <div className="mb-4">
          <h1 className="text-2xl font-black text-foreground">Belohnungen</h1>
          <p className="text-sm text-muted-foreground">Wähle deine Goodies und löse Punkte ein.</p>
        </div>

        {/* Current Status */}
        <Card className="p-4 mb-4 bg-card shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Du:</span>
              <span className="font-bold text-foreground">
                {myRank !== null ? `Platz ${myRank}` : `${myFlashes}`}
              </span>
              {myRank === null && <Zap className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Klasse:</span>
              <span className="font-bold text-foreground">{classFlashes}</span>
              <Zap className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="personal" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Für mich
            </TabsTrigger>
            <TabsTrigger value="class" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Für die Klasse
            </TabsTrigger>
          </TabsList>

          {/* Personal Rewards Tab */}
          <TabsContent value="personal" className="space-y-4">
            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={activeCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(cat.id)}
                  className="whitespace-nowrap"
                >
                  {cat.label}
                </Button>
              ))}
            </div>

            {/* Rewards Grid */}
            {loading ? (
              <Card className="p-6 text-center text-muted-foreground">Belohnungen werden geladen...</Card>
            ) : filteredRewards.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">Noch keine Belohnungen verfügbar.</Card>
            ) : (
            <div className="grid grid-cols-3 gap-2">
              {filteredRewards.map((reward) => {
                const rewardRank = rewards.indexOf(reward) + 1;
                const isWinner = myRank !== null && myRank === rewardRank;
                const isInRange = myRank !== null && myRank <= rewardRank;

                return (
                  <div
                    key={reward.id}
                    className="flex flex-col rounded-2xl overflow-hidden border border-border bg-card shadow-sm"
                  >
                    {/* Image area */}
                    <div className="relative aspect-square bg-muted">
                      {reward.image_url ? (
                        <img src={reward.image_url} alt={reward.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-3xl">{reward.icon || "🎁"}</span>
                        </div>
                      )}
                      <div className="absolute top-1.5 right-1.5">
                        {isWinner ? (
                          <CheckCircle className="h-4 w-4 text-primary drop-shadow-sm" />
                        ) : (
                          <Lock className="h-4 w-4 text-zinc-400 drop-shadow-sm" />
                        )}
                      </div>
                      {/* Rank badge */}
                      <div className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        isWinner ? "bg-primary text-primary-foreground" :
                        isInRange ? "bg-yellow-400 text-yellow-900" :
                        "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                      }`}>
                        P{rewardRank}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-2 flex flex-col gap-0.5 flex-1">
                      <span className="font-bold text-[11px] leading-tight text-foreground line-clamp-2">
                        {reward.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        Sponsor: {reward.partner || "BOOST"}
                      </span>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <span className="text-[11px] font-bold text-muted-foreground">Platz {rewardRank}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-[11px] h-7 mt-1 rounded-lg"
                        onClick={() => setSelectedReward(reward)}
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            )}

            {/* Challenges Grid */}
            <Card className="p-5 bg-card shadow-lg mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-foreground">Mehr Blitze gefällig?</h3>
                <Zap className="h-6 w-6 text-yellow-500 fill-yellow-500" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Tageschallenge */}
                <button 
                  onClick={() => navigate("/dashboard")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors border-2 border-primary/30"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-primary fill-primary" />
                  </div>
                  <span className="font-bold text-foreground text-sm">Tageschallenge</span>
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
                    1 Wdh. / 1 Sek. = {BOOST_POINT_RULES.repOrSecond} ⚡
                  </span>
                </button>

                {/* 2-Wochen Challenge */}
                <button 
                  onClick={() => navigate("/challenge/weekly")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-colors border-2 border-blue-500/30"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-blue-500" />
                  </div>
                  <span className="font-bold text-foreground text-sm">Wochenchallenge</span>
                  <span className="text-xs bg-blue-500/20 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                    +{BOOST_POINT_RULES.weeklyChallengeCompleted} ⚡
                  </span>
                </button>

                {/* Friendquest */}
                <button 
                  onClick={() => navigate("/challenge/friend")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 transition-colors border-2 border-purple-500/30"
                >
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Swords className="h-6 w-6 text-purple-500" />
                  </div>
                  <span className="font-bold text-foreground text-sm">Friendquest</span>
                  <span className="text-xs bg-purple-500/20 text-purple-600 px-2 py-0.5 rounded-full font-bold">+{BOOST_POINT_RULES.friendQuestCompleted} ⚡</span>
                </button>

                {/* Try It */}
                <button 
                  onClick={() => navigate("/challenge/tryit")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 transition-colors border-2 border-orange-500/30"
                >
                  <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-orange-500" />
                  </div>
                  <span className="font-bold text-foreground text-sm">Try It</span>
                  <span className="text-xs bg-orange-500/20 text-orange-600 px-2 py-0.5 rounded-full font-bold">
                    +{BOOST_POINT_RULES.tryItCompleted} ⚡
                  </span>
                </button>
              </div>
            </Card>

            {/* Transparency Note */}
            <p className="text-xs text-muted-foreground text-center mt-4 px-4">
              Solange der Vorrat reicht. Keine Käufe, keine Werbung – Rewards als Motivation für Bewegung.
            </p>
          </TabsContent>

          {/* Class Rewards Tab */}
          <TabsContent value="class" className="space-y-4">
            <Card className="p-4 bg-primary/5 border-primary/20">
              <p className="text-sm text-center text-foreground">
                <span className="font-bold">Jeder Blitz zählt für eure Klasse.</span><br />
                <span className="text-muted-foreground">Gemeinsam schafft ihr das nächste Ziel!</span>
              </p>
            </Card>

            {/* Milestone Roadmap */}
            <div className="relative">
              {milestones.map((milestone, index) => {
                const isUnlocked = classFlashes >= milestone.threshold;
                const progress = Math.min((classFlashes / milestone.threshold) * 100, 100);
                const flashesNeeded = milestone.threshold - classFlashes;
                const isNext = !isUnlocked && (index === 0 || classFlashes >= milestones[index - 1].threshold);

                return (
                  <div key={milestone.threshold} className="relative">
                    {/* Connector Line */}
                    {index > 0 && (
                      <div className="absolute left-6 -top-4 w-0.5 h-4 bg-border" />
                    )}
                    
                    <Card 
                      className={`p-4 mb-4 ${
                        isUnlocked 
                          ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900" 
                          : isNext 
                            ? "bg-primary/5 border-primary/30" 
                            : "bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`text-3xl w-12 h-12 flex items-center justify-center rounded-full ${
                          isUnlocked 
                            ? "bg-green-100 dark:bg-green-900/30" 
                            : "bg-muted"
                        }`}>
                          {isUnlocked ? "✅" : milestone.icon || "🎯"}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-foreground">{milestone.title}</span>
                            <div className="flex items-center gap-1 text-sm">
                              <span className="font-bold">{milestone.threshold}</span>
                              <Zap className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {milestone.description || "Gemeinsam als Klasse dieses Ziel erreichen."}
                          </p>
                          
                          {!isUnlocked && (
                            <div className="space-y-1">
                              <Progress value={progress} className="h-2" />
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{classFlashes} / {milestone.threshold}</span>
                                <span className="text-primary font-medium">
                                  Noch {flashesNeeded} ⚡
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {isUnlocked && (
                            <div className="flex items-center gap-2 text-primary text-sm">
                              <CheckCircle className="h-4 w-4" />
                              <span className="font-medium">Freigeschaltet!</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>

            {/* Challenges Grid */}
            <Card className="p-5 bg-card shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-foreground">Mehr Blitze gefällig?</h3>
                <Zap className="h-6 w-6 text-yellow-500 fill-yellow-500" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Tageschallenge */}
                <button 
                  onClick={() => navigate("/dashboard")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors border-2 border-primary/30"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-primary fill-primary" />
                  </div>
                  <span className="font-bold text-foreground text-sm">Tageschallenge</span>
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
                    1 Wdh. / 1 Sek. = {BOOST_POINT_RULES.repOrSecond} ⚡
                  </span>
                </button>

                {/* 2-Wochen Challenge */}
                <button 
                  onClick={() => navigate("/challenge/weekly")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-colors border-2 border-blue-500/30"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-blue-500" />
                  </div>
                  <span className="font-bold text-foreground text-sm">Wochenchallenge</span>
                  <span className="text-xs bg-blue-500/20 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                    +{BOOST_POINT_RULES.weeklyChallengeCompleted} ⚡
                  </span>
                </button>

                {/* Friendquest */}
                <button 
                  onClick={() => navigate("/challenge/friend")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 transition-colors border-2 border-purple-500/30"
                >
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Swords className="h-6 w-6 text-purple-500" />
                  </div>
                  <span className="font-bold text-foreground text-sm">Friendquest</span>
                  <span className="text-xs bg-purple-500/20 text-purple-600 px-2 py-0.5 rounded-full font-bold">+{BOOST_POINT_RULES.friendQuestCompleted} ⚡</span>
                </button>

                {/* Try It */}
                <button 
                  onClick={() => navigate("/challenge/tryit")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 transition-colors border-2 border-orange-500/30"
                >
                  <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-orange-500" />
                  </div>
                  <span className="font-bold text-foreground text-sm">Try It</span>
                  <span className="text-xs bg-orange-500/20 text-orange-600 px-2 py-0.5 rounded-full font-bold">
                    +{BOOST_POINT_RULES.tryItCompleted} ⚡
                  </span>
                </button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />

      {/* Details Modal */}
      <Dialog open={!!selectedReward} onOpenChange={(open) => !open && setSelectedReward(null)}>
        {selectedReward && (() => {
          const rewardRank = rewards.indexOf(selectedReward) + 1;
          const isWinner = myRank !== null && myRank === rewardRank;
          const isInRange = myRank !== null && myRank <= rewardRank;
          return (
            <DialogContent className="max-w-sm mx-auto">
              <DialogHeader>
                <DialogTitle className="text-lg font-black">{selectedReward.title}</DialogTitle>
              </DialogHeader>

              {/* Image */}
              <div className="aspect-video rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                {selectedReward.image_url ? (
                  <img src={selectedReward.image_url} alt={selectedReward.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-6xl">{selectedReward.icon || "🎁"}</span>
                )}
              </div>

              {/* Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Sponsor:</span>
                  <span className="font-semibold text-sm">{selectedReward.partner || "BOOST"}</span>
                  {selectedReward.sponsor_logo_url && (
                    <img src={selectedReward.sponsor_logo_url} alt={selectedReward.partner || ""} className="h-5 object-contain opacity-80" />
                  )}
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">Dieser Preis geht an:</span>
                  <span className="font-bold text-sm">Platz {rewardRank}</span>
                </div>

                <div className={`flex items-center gap-2 p-3 rounded-xl ${isWinner ? "bg-primary/10 border border-primary/30" : "bg-muted/50"}`}>
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Dein aktueller Rang:</span>
                  <span className={`font-bold text-sm ${isWinner ? "text-primary" : ""}`}>
                    {myRank !== null ? `Platz ${myRank}` : "–"}
                  </span>
                  {isWinner && <CheckCircle className="h-4 w-4 text-primary ml-auto" />}
                </div>

                {!isWinner && myRank !== null && myRank > rewardRank && (
                  <p className="text-xs text-muted-foreground text-center">
                    Du musst dich von Platz {myRank} auf Platz {rewardRank} verbessern, um diesen Preis zu gewinnen.
                  </p>
                )}
              </div>

              {/* Action */}
              {isWinner ? (
                <Button
                  className="w-full"
                  onClick={() => { void handleRedeem(selectedReward.id); setSelectedReward(null); }}
                  disabled={redeemingId === selectedReward.id}
                >
                  {redeemingId === selectedReward.id ? "Wird angefordert..." : "Belohnung anfordern"}
                </Button>
              ) : isInRange ? (
                <Button variant="outline" className="w-full" onClick={() => setSelectedReward(null)}>
                  Du bist auf Platz {myRank} – halte deinen Rang!
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setSelectedReward(null); navigate("/dashboard"); }}
                >
                  Mehr Blitze für besseren Rang <Zap className="h-4 w-4 ml-1" />
                </Button>
              )}
            </DialogContent>
          );
        })()}
      </Dialog>
    </div>
  );
};

export default Rewards;
