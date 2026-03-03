import { useEffect, useState } from "react";
import { Trophy, Zap, ArrowUp, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

interface ClassRanking {
  className: string;
  school: string;
  totalFlashes: number;
}

interface Props {
  userClass: string;
  userSchool: string;
}

const CLASS_MILESTONE = 300;

export const ClassLeaderboard = ({ userClass, userSchool }: Props) => {
  const [rankings, setRankings] = useState<ClassRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRankings();
  }, []);

  const loadRankings = async () => {
    try {
      // Aggregate points by class+school from profiles
      const { data } = await supabase
        .from("profiles")
        .select("class, school, points");

      if (data) {
        const classMap = new Map<string, ClassRanking>();
        for (const p of data) {
          const key = `${p.class}|${p.school}`;
          const existing = classMap.get(key);
          if (existing) {
            existing.totalFlashes += p.points;
          } else {
            classMap.set(key, {
              className: p.class,
              school: p.school,
              totalFlashes: p.points,
            });
          }
        }
        const sorted = Array.from(classMap.values()).sort(
          (a, b) => b.totalFlashes - a.totalFlashes
        );
        setRankings(sorted);
      }
    } catch (err) {
      console.error("Error loading rankings:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  const top5 = rankings.slice(0, 5);
  const myClassIndex = rankings.findIndex(
    (r) => r.className === userClass && r.school === userSchool
  );
  const myClass = myClassIndex >= 0 ? rankings[myClassIndex] : null;
  const myRank = myClassIndex >= 0 ? myClassIndex + 1 : null;
  const isInTop5 = myRank !== null && myRank <= 5;
  const classFlashes = myClass?.totalFlashes || 0;
  const classProgress = Math.min((classFlashes / CLASS_MILESTONE) * 100, 100);

  const flashesToNextRank =
    myRank && myRank > 1
      ? rankings[myClassIndex - 1].totalFlashes - classFlashes + 1
      : 0;

  return (
    <>
      {/* Class summary */}
      <Card className="p-4 bg-card shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">Unsere Klasse</span>
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-primary/10 px-3 py-1 rounded-full">
            <span className="font-bold text-primary">{userClass}</span>
          </div>
          <span className="text-xs text-muted-foreground">{userSchool}</span>
          {myRank && (
            <span className="text-xs font-bold text-primary ml-auto">Platz {myRank}</span>
          )}
        </div>
        <div className="flex items-end gap-2 mb-3">
          <span className="text-3xl font-black text-foreground">{classFlashes}</span>
          <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500 mb-0.5" />
          <span className="text-sm text-muted-foreground mb-0.5">gesamt</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Klassen-Geschenk</span>
            <span className="font-bold">{CLASS_MILESTONE} ⚡</span>
          </div>
          <Progress value={classProgress} className="h-2" />
          {classFlashes < CLASS_MILESTONE && (
            <p className="text-xs text-center text-muted-foreground">
              Noch <span className="font-bold text-primary">{CLASS_MILESTONE - classFlashes} ⚡</span> bis zum Geschenk 🎁
            </p>
          )}
        </div>
      </Card>

      {/* Leaderboard */}
      <Card className="p-4 bg-card shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">Top 5 Klassen</span>
          <Trophy className="h-5 w-5 text-yellow-500" />
        </div>

        <div className="space-y-1.5">
          {top5.map((entry, i) => {
            const rank = i + 1;
            const isMe = entry.className === userClass && entry.school === userSchool;
            return (
              <div
                key={`${entry.className}-${entry.school}`}
                className={`flex items-center justify-between p-2.5 rounded-lg ${
                  isMe ? "bg-primary/10 border border-primary" : "bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                      rank === 1 ? "bg-yellow-500 text-white" :
                      rank === 2 ? "bg-gray-400 text-white" :
                      rank === 3 ? "bg-amber-600 text-white" :
                      "bg-muted text-muted-foreground"
                    }`}
                  >
                    {rank}
                  </div>
                  <div>
                    <span className={`font-bold text-sm ${isMe ? "text-primary" : "text-foreground"}`}>
                      {entry.className}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1.5">{entry.school}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-sm">{entry.totalFlashes}</span>
                  <Zap className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                </div>
              </div>
            );
          })}

          {/* Own class if not in top 5 */}
          {!isInTop5 && myClass && myRank && (
            <>
              <div className="text-center text-muted-foreground text-xs py-0.5">···</div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/10 border border-primary">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs bg-primary/20 text-primary">
                    {myRank}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-primary">{userClass}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">{userSchool}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-sm">{classFlashes}</span>
                  <Zap className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                </div>
              </div>
            </>
          )}
        </div>

        {flashesToNextRank > 0 && (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-center gap-1.5 text-xs">
            <ArrowUp className="h-3.5 w-3.5 text-primary" />
            <span>
              Noch <span className="font-bold text-primary">{flashesToNextRank} ⚡</span> bis Platz {myRank! - 1}
            </span>
          </div>
        )}
      </Card>
    </>
  );
};
