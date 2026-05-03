import { Zap, Calendar, Swords, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { BOOST_POINT_RULES } from "@/lib/gamification";

export const ChallengeButtons = () => {
  const navigate = useNavigate();
  const flashOverview = [
    { label: "1 Wdh. / 1 Sek.", reward: `+${BOOST_POINT_RULES.repOrSecond} ⚡` },
    { label: "Tagesziel geschafft", reward: `+${BOOST_POINT_RULES.dailyGoalCompleted} ⚡` },
    { label: "Wochenchallenge", reward: `+${BOOST_POINT_RULES.weeklyChallengeCompleted} ⚡` },
    { label: "Try It ausprobiert", reward: `+${BOOST_POINT_RULES.tryItCompleted} ⚡` },
    { label: "3 Tage aktiv in Folge", reward: `+${BOOST_POINT_RULES.streak3DaysBonus} ⚡ Bonus` },
    { label: "7 Tage Streak", reward: `+${BOOST_POINT_RULES.streak7DaysBonus} ⚡ Bonus` },
  ];

  const challenges = [
    { label: "Tageschallenge", reward: `1 Wdh. / 1 Sek. = ${BOOST_POINT_RULES.repOrSecond} ⚡`, icon: Zap, path: "/challenge/daily", colorClass: "bg-primary/10 hover:bg-primary/20 border-primary/30", iconBg: "bg-primary/20", iconColor: "text-primary fill-primary", rewardBg: "bg-primary/20 text-primary" },
    { label: "Wochenchallenge", reward: `+${BOOST_POINT_RULES.weeklyChallengeCompleted} ⚡`, icon: Calendar, path: "/challenge/weekly", colorClass: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30", iconBg: "bg-blue-500/20", iconColor: "text-blue-500", rewardBg: "bg-blue-500/20 text-blue-600" },
    { label: "Friendquest", reward: `+${BOOST_POINT_RULES.friendQuestCompleted} ⚡`, icon: Swords, path: "/challenge/friend", colorClass: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30", iconBg: "bg-purple-500/20", iconColor: "text-purple-500", rewardBg: "bg-purple-500/20 text-purple-600" },
    { label: "Try It", reward: `+${BOOST_POINT_RULES.tryItCompleted} ⚡`, icon: MapPin, path: "/challenge/tryit", colorClass: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30", iconBg: "bg-orange-500/20", iconColor: "text-orange-500", rewardBg: "bg-orange-500/20 text-orange-600" },
  ];

  return (
    <Card className="p-4 bg-card shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-base text-foreground">Mehr Blitze gefällig?</h3>
        <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {challenges.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.path}
              onClick={() => navigate(c.path)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors border-2 ${c.colorClass}`}
            >
              <div className={`w-10 h-10 rounded-full ${c.iconBg} flex items-center justify-center`}>
                <Icon className={`h-5 w-5 ${c.iconColor}`} />
              </div>
              <span className="font-bold text-foreground text-xs">{c.label}</span>
              <span className={`text-[10px] ${c.rewardBg} px-2 py-0.5 rounded-full font-bold`}>{c.reward}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          So sammelst du Blitze
        </p>
        <div className="mt-3 grid gap-2">
          {flashOverview.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 text-sm"
            >
              <span className="text-foreground">{item.label}</span>
              <span className="whitespace-nowrap font-bold text-primary">{item.reward}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
