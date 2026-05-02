import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Lock, CheckCircle, Users, User, Calendar, Swords, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  { id: "fallback-bipa-50", title: "BIPA Gutschein 5 EUR", partner: "BIPA", threshold: 50, category: "gutscheine", icon: "🎀" },
  { id: "fallback-dm-75", title: "dm Gutschein 5 EUR", partner: "dm", threshold: 75, category: "gutscheine", icon: "🧴" },
  { id: "fallback-intersport-100", title: "Sport-Trinkflasche", partner: "Intersport", threshold: 100, category: "sport", icon: "🍶" },
  { id: "fallback-spar-200", title: "SPAR Gutschein 10 EUR", partner: "SPAR", threshold: 200, category: "gutscheine", icon: "🛒" },
  { id: "fallback-intersport-400", title: "Sport-Rucksack", partner: "Intersport", threshold: 400, category: "sport", icon: "🎒" },
];

const fallbackMilestones: ClassMilestone[] = [
  {
    id: "fallback-class-2500",
    threshold: 2500,
    title: "Klassen-Equipment",
    description: "Bälle, Seile und mehr für eure Klasse.",
    icon: "⚽",
    sort_order: 1,
  },
  {
    id: "fallback-class-4000",
    threshold: 4000,
    title: "Klassen-Event",
    description: "Ein gemeinsames Sport-Event als nächstes großes Ziel.",
    icon: "🎉",
    sort_order: 2,
  },
  {
    id: "fallback-class-6000",
    threshold: 6000,
    title: "Partner-Paket",
    description: "Ein Überraschungspaket für die ganze Klasse.",
    icon: "🎁",
    sort_order: 3,
  },
];

const Rewards = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("alle");
  const [myFlashes, setMyFlashes] = useState(0);
  const [classFlashes, setClassFlashes] = useState(0);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [milestones, setMilestones] = useState<ClassMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  useEffect(() => {
    loadRewardsData();
  }, []);

  const loadRewardsData = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getSession();
    const uid = authData.session?.user?.id;
    const email = authData.session?.user?.email;
    if (!uid) {
      navigate("/auth");
      return;
    }
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

    const [{ data: rewardRows, error: rewardsError }, { data: milestoneRows, error: milestonesError }, { data: classPoints, error: classPointsError }] =
      await Promise.all([
        (supabase as any)
          .from("reward_items")
          .select("id, title, partner, threshold, category, icon")
          .eq("is_active", true)
          .order("threshold", { ascending: true }),
        (supabase as any)
          .from("class_milestones")
          .select("id, threshold, title, description, icon, sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("threshold", { ascending: true }),
        (supabase.rpc as any)("get_class_total_points", { p_school: profile.school, p_class: profile.class }),
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

    setLoading(false);
  };

  const handleRedeem = async (rewardId: string) => {
    if (!userId) return;
    setRedeemingId(rewardId);

    const { error } = await (supabase as any).from("reward_redemptions").insert({
      user_id: userId,
      reward_id: rewardId,
      status: "requested",
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

      <div className="max-w-screen-xl mx-auto px-4 -mt-4">
        {/* Current Status */}
        <Card className="p-4 mb-4 bg-card shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Du:</span>
                <span className="font-bold text-foreground">{myFlashes}</span>
                <Zap className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Klasse:</span>
                <span className="font-bold text-foreground">{classFlashes}</span>
                <Zap className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              </div>
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
            <div className="grid gap-3">
              {filteredRewards.map((reward) => {
                const isUnlocked = myFlashes >= reward.threshold;
                const flashesNeeded = reward.threshold - myFlashes;
                
                return (
                  <Card 
                    key={reward.id}
                    className={`p-4 ${isUnlocked ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900" : "bg-card"}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">{reward.icon || "🎁"}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-foreground">{reward.title}</span>
                          {isUnlocked ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          Partner: {reward.partner || "BOOST"}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-muted-foreground">ab</span>
                            <span className="font-bold">{reward.threshold}</span>
                            <Zap className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          </div>
                          {!isUnlocked && (
                            <span className="text-xs text-orange-500">
                              (noch {flashesNeeded} ⚡)
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        {isUnlocked ? (
                          <Button
                            size="sm"
                            className="bg-green-500 hover:bg-green-600"
                            onClick={() => handleRedeem(reward.id)}
                            disabled={redeemingId === reward.id}
                          >
                            {redeemingId === reward.id ? "..." : "Anfordern"}
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => navigate("/challenge/daily")}
                          >
                            Mehr ⚡
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
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
                  onClick={() => navigate("/challenge/daily")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors border-2 border-primary/30"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-primary fill-primary" />
                  </div>
                  <span className="font-bold text-foreground text-sm">Tageschallenge</span>
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
                    +{BOOST_POINT_RULES.exerciseCompleted} / +{BOOST_POINT_RULES.dailyGoalCompleted} ⚡
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
                  <span className="text-xs bg-purple-500/20 text-purple-600 px-2 py-0.5 rounded-full font-bold">+20-50 ⚡</span>
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
                            <div className="flex items-center gap-2 text-green-600 text-sm">
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
                  onClick={() => navigate("/challenge/daily")}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors border-2 border-primary/30"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-primary fill-primary" />
                  </div>
                  <span className="font-bold text-foreground text-sm">Tageschallenge</span>
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
                    +{BOOST_POINT_RULES.exerciseCompleted} / +{BOOST_POINT_RULES.dailyGoalCompleted} ⚡
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
                  <span className="text-xs bg-purple-500/20 text-purple-600 px-2 py-0.5 rounded-full font-bold">+20-50 ⚡</span>
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
    </div>
  );
};

export default Rewards;
