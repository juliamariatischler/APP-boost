import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Users, Trophy, ArrowUp, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BottomNav } from "@/components/BottomNav";
import boostLogo from "@/assets/boost-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { de } from "date-fns/locale";

// Mock data for class leaderboard (would come from DB in production)
const MOCK_LEADERBOARD = [
  { rank: 1, className: "4b", school: "VS Mariahilf", flashes: 312 },
  { rank: 2, className: "3a", school: "VS Lend", flashes: 287 },
  { rank: 3, className: "4a", school: "VS Geidorf", flashes: 265 },
  { rank: 4, className: "2b", school: "VS Andritz", flashes: 248 },
  { rank: 5, className: "3c", school: "VS Eggenberg", flashes: 231 },
];

const CLASS_MILESTONE = 300;

const Boost = () => {
  const navigate = useNavigate();
  const [myFlashes, setMyFlashes] = useState(0);
  const [weeklyFlashes, setWeeklyFlashes] = useState(0);
  const [classFlashes, setClassFlashes] = useState(248); // Mock: would aggregate from all class members
  const [todayComplete, setTodayComplete] = useState(false);
  const [userClass, setUserClass] = useState({ className: "3a", school: "Ursulinen" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("points, class, school")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setMyFlashes(profile.points);
        setUserClass({ className: profile.class, school: profile.school });
      }

      // Get weekly flashes
      const today = new Date();
      const weekStart = startOfWeek(today, { locale: de, weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { locale: de, weekStartsOn: 1 });

      const { data: weeklyData } = await supabase
        .from("daily_results")
        .select("*")
        .eq("user_id", session.user.id)
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"));

      if (weeklyData) {
        // Count days with completed challenges as flashes earned
        const completedDays = weeklyData.filter(day => 
          (day.steps || 0) >= 3000 && 
          (day.jumping_jacks || 0) >= 20 &&
          (day.push_ups || 0) >= 20 &&
          (day.squats || 0) >= 20 &&
          (day.planks || 0) >= 30 &&
          (day.sit_ups || 0) >= 20
        ).length;
        setWeeklyFlashes(completedDays);
      }

      // Check if today's challenge is complete
      const { data: todayData } = await supabase
        .from("daily_results")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("date", format(today, "yyyy-MM-dd"))
        .single();

      if (todayData) {
        const stepsComplete = (todayData.steps || 0) >= 3000;
        const exercisesComplete = 
          (todayData.jumping_jacks || 0) >= 20 &&
          (todayData.push_ups || 0) >= 20 &&
          (todayData.squats || 0) >= 20 &&
          (todayData.planks || 0) >= 30 &&
          (todayData.sit_ups || 0) >= 20;
        setTodayComplete(stepsComplete && exercisesComplete);
      }
    } catch (error) {
      console.error("Error loading boost data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate class rank and distance to next
  const myClassInTop5 = MOCK_LEADERBOARD.find(c => c.className === userClass.className && c.school === userClass.school);
  const myClassRank = myClassInTop5 ? myClassInTop5.rank : 8; // Mock rank if not in top 5
  const flashesToNextRank = myClassRank > 1 
    ? (MOCK_LEADERBOARD[myClassRank - 2]?.flashes || 0) - classFlashes + 1
    : 0;

  const classProgress = Math.min((classFlashes / CLASS_MILESTONE) * 100, 100);
  const flashesToMilestone = CLASS_MILESTONE - classFlashes;

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-16">
        <div className="animate-pulse h-96 m-4 bg-muted rounded-lg" />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-yellow-500 to-orange-500 p-6 pb-8">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Zap className="h-7 w-7 fill-white" />
              Blitze
            </h1>
            <img src={boostLogo} alt="BOOST Logo" className="h-10 w-auto brightness-0 invert" />
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 -mt-4 space-y-4">
        {/* A) Meine Blitze */}
        <Card className="p-5 bg-card shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Meine Blitze</span>
            <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500" />
          </div>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-5xl font-black text-foreground">{myFlashes}</span>
            <Zap className="h-8 w-8 text-yellow-500 fill-yellow-500 mb-1" />
          </div>
          <p className="text-sm text-muted-foreground">
            Diese Woche gesammelt: <span className="font-bold text-primary">+{weeklyFlashes} ⚡</span>
          </p>
          
          {/* Today status */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              {todayComplete ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-green-600">Heute erledigt! 🎉</span>
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5 text-orange-500" />
                  <span className="text-sm text-muted-foreground">Heute noch nicht erledigt</span>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* B) Unsere Klasse */}
        <Card className="p-5 bg-card shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Unsere Klasse</span>
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-primary/10 px-3 py-1 rounded-full">
              <span className="font-bold text-primary">{userClass.className}</span>
            </div>
            <span className="text-sm text-muted-foreground">{userClass.school}</span>
          </div>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-4xl font-black text-foreground">{classFlashes}</span>
            <Zap className="h-6 w-6 text-yellow-500 fill-yellow-500 mb-1" />
            <span className="text-muted-foreground mb-1">gesamt</span>
          </div>
          
          {/* Progress to milestone */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Fortschritt zum Klassen-Geschenk</span>
              <span className="font-bold">{CLASS_MILESTONE} ⚡</span>
            </div>
            <Progress value={classProgress} className="h-3" />
            <p className="text-sm text-center">
              Noch <span className="font-bold text-primary">{flashesToMilestone} ⚡</span> bis zum nächsten Klassen-Geschenk 🎁
            </p>
          </div>
        </Card>

        {/* C) Wettkampf: Top 5 */}
        <Card className="p-5 bg-card shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-muted-foreground">Wettkampf: Top 5 Klassen</span>
            <Trophy className="h-5 w-5 text-yellow-500" />
          </div>
          
          <div className="space-y-2">
            {MOCK_LEADERBOARD.map((entry) => {
              const isMyClass = entry.className === userClass.className && entry.school === userClass.school;
              return (
                <div 
                  key={entry.rank}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    isMyClass 
                      ? "bg-primary/10 border-2 border-primary" 
                      : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      entry.rank === 1 ? "bg-yellow-500 text-white" :
                      entry.rank === 2 ? "bg-gray-400 text-white" :
                      entry.rank === 3 ? "bg-amber-600 text-white" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {entry.rank}
                    </div>
                    <div>
                      <span className={`font-bold ${isMyClass ? "text-primary" : "text-foreground"}`}>
                        {entry.className}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">{entry.school}</span>
                      {isMyClass && <span className="text-xs text-primary ml-2">← Ihr</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold">{entry.flashes}</span>
                    <Zap className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  </div>
                </div>
              );
            })}
            
            {/* Show own class if not in top 5 */}
            {!myClassInTop5 && (
              <>
                <div className="text-center text-muted-foreground text-sm py-1">···</div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border-2 border-primary">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-primary/20 text-primary">
                      {myClassRank}
                    </div>
                    <div>
                      <span className="font-bold text-primary">{userClass.className}</span>
                      <span className="text-xs text-muted-foreground ml-2">{userClass.school}</span>
                      <span className="text-xs text-primary ml-2">← Ihr</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold">{classFlashes}</span>
                    <Zap className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Distance to next rank */}
          {flashesToNextRank > 0 && (
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-center gap-2 text-sm">
              <ArrowUp className="h-4 w-4 text-primary" />
              <span>
                Noch <span className="font-bold text-primary">{flashesToNextRank} ⚡</span> bis Platz {myClassRank - 1}
              </span>
            </div>
          )}
        </Card>

        {/* D) CTA */}
        <Card className="p-5 bg-gradient-to-br from-primary to-accent text-white shadow-lg">
          {todayComplete ? (
            <div className="text-center">
              <CheckCircle className="h-10 w-10 mx-auto mb-2" />
              <h3 className="font-bold text-lg mb-1">Super gemacht! 🎉</h3>
              <p className="text-sm opacity-90 mb-3">Du hast heute alles erledigt.</p>
              <p className="text-sm opacity-75">Morgen wieder sammeln!</p>
            </div>
          ) : (
            <div className="text-center">
              <Zap className="h-10 w-10 mx-auto mb-2 fill-white" />
              <h3 className="font-bold text-lg mb-1">Hol dir deine Blitze!</h3>
              <p className="text-sm opacity-90 mb-4">Schließe die Tageschallenge ab.</p>
              <Button 
                onClick={() => navigate("/challenge/daily")}
                className="bg-white text-primary hover:bg-white/90 font-bold"
              >
                Zur Tageschallenge
              </Button>
            </div>
          )}
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default Boost;
