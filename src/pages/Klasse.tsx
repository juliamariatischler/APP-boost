import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Zap } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { TopHeader } from "@/components/TopHeader";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { BOOST_POINT_RULES, DAILY_STEP_GOAL, WEEKLY_GOAL_DAYS } from "@/lib/gamification";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { de } from "date-fns/locale";

type SubTab = "wochenquest" | "klasse" | "tryit";

interface StudentRanking {
  id: string;
  username: string;
  points: number;
}

interface ClassRanking {
  className: string;
  school: string;
  totalFlashes: number;
}

interface PresentationClassRankingRow {
  school: string;
  class: string;
  total_flashes: number | null;
}

const AVATAR_COLORS = [
  "bg-green-500", "bg-blue-500", "bg-orange-500", "bg-purple-500",
  "bg-pink-500", "bg-yellow-500", "bg-red-500", "bg-teal-500",
];

const getInitials = (name: string) =>
  name.slice(0, 2).toUpperCase();

const Klasse = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SubTab>("wochenquest");
  const [userClass, setUserClass] = useState("");
  const [userSchool, setUserSchool] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [studentRankings, setStudentRankings] = useState<StudentRanking[]>([]);
  const [classRankings, setClassRankings] = useState<ClassRanking[]>([]);
  const [weeklyCompleted, setWeeklyCompleted] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { navigate("/"); return; }
        setUserId(session.user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("class, school")
          .eq("id", session.user.id)
          .single();

        if (profile) {
          setUserClass(profile.class || "");
          setUserSchool(profile.school || "");
          await Promise.all([
            loadStudentRankings(profile.class, profile.school),
            loadClassRankings(),
            loadWeeklyProgress(session.user.id),
          ]);
        } else {
          await Promise.all([
            loadClassRankings(),
            loadWeeklyProgress(session.user.id),
          ]);
        }
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [navigate]);

  const loadStudentRankings = async (cls: string, school: string) => {
    if (!cls || !school) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, username, points")
      .eq("class", cls)
      .eq("school", school)
      .order("points", { ascending: false })
      .limit(10);
    if (data) setStudentRankings(data);
  };

  const loadClassRankings = async () => {
    const presentationTable = supabase as typeof supabase & {
      from: (table: "presentation_class_rankings") => {
        select: (
          columns: string,
        ) => {
          eq: (column: string, value: boolean) => {
            order: (
              column: string,
              options: { ascending: boolean },
            ) => {
              limit: (count: number) => Promise<{
                data: PresentationClassRankingRow[] | null;
                error: unknown;
              }>;
            };
          };
        };
      };
    };

    const { data, error } = await presentationTable
      .from("presentation_class_rankings")
      .select("school, class, total_flashes")
      .eq("is_active", true)
      .order("total_flashes", { ascending: false })
      .limit(5);

    if (!error && data && data.length > 0) {
      setClassRankings(
        data.map((r) => ({
          className: r.class,
          school: r.school,
          totalFlashes: Number(r.total_flashes || 0),
        }))
      );
    } else {
      setClassRankings([
        { className: "3b", school: "NMS Klusemann", totalFlashes: 2840 },
        { className: "4a", school: "NMS Straden", totalFlashes: 2635 },
        { className: "3e", school: "Ursulinen", totalFlashes: 2410 },
      ]);
    }
  };

  const loadWeeklyProgress = async (uid: string) => {
    const today = new Date();
    const weekStart = startOfWeek(today, { locale: de, weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { locale: de, weekStartsOn: 1 });
    const { data } = await supabase
      .from("daily_results")
      .select("*")
      .eq("user_id", uid)
      .gte("date", format(weekStart, "yyyy-MM-dd"))
      .lte("date", format(weekEnd, "yyyy-MM-dd"));
    if (data) {
      const activeDays = data.filter(
        (d) => (d.jumping_jacks || 0) + (d.push_ups || 0) + (d.squats || 0) + (d.planks || 0) + (d.sit_ups || 0) > 0
      ).length;
      setWeeklyCompleted(activeDays);
    }
  };

  const top3 = studentRankings.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  const tabs: { key: SubTab; label: string }[] = [
    { key: "wochenquest", label: "Wochen-Quest" },
    { key: "klasse", label: "Klasse" },
    { key: "tryit", label: "Try It" },
  ];

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <TopHeader />

      {/* Sub-Tab Bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-xl px-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-screen-xl px-4 pt-4">
        {/* WOCHEN-QUEST TAB */}
        {activeTab === "wochenquest" && (
          <div className="space-y-4">
            {/* Quest Header Card */}
            <div className="rounded-[28px] bg-[linear-gradient(135deg,#b9ff63_0%,#85df2f_100%)] p-5 text-zinc-950 shadow-[0_20px_60px_rgba(137,217,54,0.28)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wide opacity-70">Wochen-Quest</span>
                <span className="rounded-full bg-black/80 px-2 py-0.5 text-xs font-bold text-white">
                  WÖCHENTLICH
                </span>
              </div>
              <h2 className="mb-4 mt-1 text-4xl font-black leading-none">
                5 aktive Tage<br />schaffen
              </h2>

              <div className="flex gap-3 mb-4">
                <div className="rounded-2xl bg-black/80 px-3 py-2 text-center text-white">
                  <div className="text-xs uppercase tracking-wide text-white/70">Belohnung</div>
                  <div className="flex items-center gap-1 font-bold">
                    <Zap className="h-4 w-4 fill-white" />
                    {BOOST_POINT_RULES.weeklyChallengeCompleted}
                  </div>
                </div>
                <div className="rounded-2xl bg-black/80 px-3 py-2 text-center text-white">
                  <div className="text-xs uppercase tracking-wide text-white/70">Endet</div>
                  <div className="flex items-center gap-1 font-bold">
                    <Clock className="h-4 w-4" />
                    So 23:59
                  </div>
                </div>
              </div>

              <div className="mb-1 flex justify-between text-sm">
                <span>Dein Fortschritt</span>
                <span className="font-bold">{Math.round((weeklyCompleted / WEEKLY_GOAL_DAYS) * 100)}%</span>
              </div>
              <Progress
                value={(weeklyCompleted / WEEKLY_GOAL_DAYS) * 100}
                className="h-2 bg-black/10 [&>div]:bg-black/80"
              />
              <p className="mt-2 text-sm text-zinc-900/80">
                {weeklyCompleted} / {WEEKLY_GOAL_DAYS} aktive Tage
                {weeklyCompleted < WEEKLY_GOAL_DAYS && (
                  <> — noch {WEEKLY_GOAL_DAYS - weeklyCompleted} Tage bis zur Belohnung ⚡</>
                )}
              </p>
            </div>

            {/* So zählt heute */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-foreground">So zählt heute</h3>
                <span className="text-xs text-muted-foreground">1 Übung reicht</span>
              </div>
              <div className="space-y-2">
                {[
                  { emoji: "🌤", label: "Tagesziel Schritte", sub: `${DAILY_STEP_GOAL.toLocaleString("de")} Schritte`, pts: `+${BOOST_POINT_RULES.dailyGoalCompleted}` },
                  { emoji: "⚡", label: "Eine Übung machen", sub: "Egal welche, ab 15 Min", pts: `+${BOOST_POINT_RULES.exerciseCompleted}` },
                  { emoji: "🔥", label: "Streak halten", sub: "Heute eingeloggt + ✓", pts: "+5" },
                ].map((item) => (
                  <div key={item.label} className="bg-card rounded-xl px-4 py-3 flex items-center justify-between border border-border">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{item.emoji}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.sub}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-primary flex items-center gap-0.5">
                      {item.pts} <Zap className="h-3.5 w-3.5 fill-primary" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* KLASSE TAB */}
        {activeTab === "klasse" && (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-black tracking-tight text-foreground">{userClass || "Meine Klasse"}</h1>
              <p className="text-sm text-muted-foreground">{userSchool}</p>
            </div>

            {/* Schul-Ranking */}
            <div>
              <h2 className="font-bold text-foreground mb-3">Schul-Ranking</h2>
              <div className="space-y-2">
                {loading ? (
                  <div className="h-32 bg-muted rounded-xl animate-pulse" />
                ) : (
                  classRankings.map((cls, i) => {
                    const isMyClass = cls.className === userClass && cls.school === userSchool;
                    return (
                      <div
                        key={`${cls.school}-${cls.className}`}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                          isMyClass ? "border-primary bg-primary/5" : "border-border bg-card"
                        }`}
                      >
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                          i === 0 ? "bg-yellow-400 text-white" : i === 1 ? "bg-gray-300 text-gray-700" : i === 2 ? "bg-orange-400 text-white" : "bg-muted text-muted-foreground"
                        }`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            Klasse {cls.className}
                            {isMyClass && <span className="ml-2 text-xs text-primary font-bold">(Du)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{cls.school}</p>
                        </div>
                        <span className="text-sm font-bold text-foreground flex items-center gap-0.5 shrink-0">
                          {cls.totalFlashes.toLocaleString("de")} <Zap className="h-3.5 w-3.5 fill-primary text-primary" />
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Top diese Woche – Podium */}
            {!loading && studentRankings.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-foreground">Top diese Woche</h2>
                </div>
                <div className="flex items-end justify-center gap-3 h-40">
                  {podiumOrder.map((student, idx) => {
                    const rank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
                    const heights = { 1: "h-32", 2: "h-24", 3: "h-20" };
                    const isMe = student?.id === userId;
                    const colorIdx = studentRankings.findIndex((s) => s.id === student?.id) % AVATAR_COLORS.length;
                    return student ? (
                      <div key={student.id} className="flex flex-col items-center gap-1 flex-1">
                        <div className={`w-10 h-10 rounded-full ${AVATAR_COLORS[colorIdx]} flex items-center justify-center text-white text-sm font-bold ${isMe ? "ring-2 ring-primary" : ""}`}>
                          {getInitials(student.username)}
                        </div>
                        <p className="text-xs font-medium text-foreground truncate max-w-[60px] text-center">
                          {student.username.split(" ")[0]}.
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-0.5">
                          {student.points} <Zap className="h-3 w-3 fill-primary text-primary" />
                        </p>
                        <div className={`w-full ${heights[rank as 1|2|3]} rounded-t-lg flex items-center justify-center text-white text-lg font-bold ${
                          rank === 1 ? "bg-yellow-400" : rank === 2 ? "bg-gray-300" : "bg-orange-300"
                        }`}>
                          {rank}
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
                {/* Rest of list */}
                {studentRankings.slice(3).map((student, i) => {
                  const isMe = student.id === userId;
                  const colorIdx = (i + 3) % AVATAR_COLORS.length;
                  return (
                    <div key={student.id} className={`flex items-center gap-3 px-4 py-2 rounded-xl mt-2 ${isMe ? "bg-primary/10 border border-primary" : "bg-card border border-border"}`}>
                      <span className="text-sm text-muted-foreground w-5 text-center">{i + 4}</span>
                      <div className={`w-8 h-8 rounded-full ${AVATAR_COLORS[colorIdx]} flex items-center justify-center text-white text-xs font-bold`}>
                        {getInitials(student.username)}
                      </div>
                      <span className="flex-1 text-sm font-medium text-foreground">{student.username}</span>
                      <span className="text-sm font-bold text-foreground flex items-center gap-0.5">
                        {student.points} <Zap className="h-3.5 w-3.5 fill-primary text-primary" />
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TRY IT TAB */}
        {activeTab === "tryit" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Try It</h2>
              <p className="text-sm text-muted-foreground">Neue Sportarten, Trainings oder Vereine testen.</p>
            </div>
            <div
              className="bg-primary rounded-2xl p-5 text-white cursor-pointer active:opacity-90"
              onClick={() => navigate("/challenge/tryit")}
            >
              <p className="text-xs font-bold uppercase tracking-wide opacity-80 mb-1">Challenge</p>
              <h3 className="text-xl font-bold mb-2">Try It – Neue Sportart</h3>
              <p className="text-sm opacity-90 mb-4">Teste eine neue Sportart oder einen Verein in deiner Nähe.</p>
              <div className="bg-white/20 rounded-xl px-3 py-2 inline-flex items-center gap-2">
                <Zap className="h-4 w-4 fill-white" />
                <span className="font-bold">+{BOOST_POINT_RULES.tryItCompleted} ⚡ pro Try-It</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Klasse;
