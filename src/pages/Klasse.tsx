import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, GraduationCap, Trophy, Zap } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import avatarPlaceholder from "@/assets/avatar-placeholder.svg";
import boostMascotBlue from "@/assets/boost-mascot-blue.png";
import { AVATAR_BASE_ASSET, AVATAR_ITEMS, AvatarItemId, loadEquippedAvatarItem } from "@/lib/avatarItems";

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
  "bg-primary", "bg-blue-500", "bg-orange-500", "bg-purple-500",
  "bg-pink-500", "bg-yellow-500", "bg-red-500", "bg-teal-500",
];

const getInitials = (name: string) =>
  name.slice(0, 2).toUpperCase();

const Klasse = () => {
  const navigate = useNavigate();
  const [userClass, setUserClass] = useState("");
  const [userSchool, setUserSchool] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [studentRankings, setStudentRankings] = useState<StudentRanking[]>([]);
  const [classRankings, setClassRankings] = useState<ClassRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllRankings, setShowAllRankings] = useState(false);
  const [equippedAvatarItem, setEquippedAvatarItem] = useState<AvatarItemId>("none");

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { navigate("/"); return; }
        setUserId(session.user.id);
        setEquippedAvatarItem(loadEquippedAvatarItem(session.user.id));

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
          ]);
        } else {
          await Promise.all([loadClassRankings()]);
        }
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;

    const handleStorage = () => {
      setEquippedAvatarItem(loadEquippedAvatarItem(userId));
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleStorage);
    };
  }, [userId]);

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
      .limit(50);

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
        { className: "2c", school: "MS Puntigam", totalFlashes: 2210 },
        { className: "1a", school: "MS Eggenberg", totalFlashes: 1980 },
        { className: "4c", school: "BRG Petersgasse", totalFlashes: 1760 },
      ]);
    }
  };

  const top3 = studentRankings.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const classQuestGoal = 1000;
  const classQuestProgress = studentRankings.reduce((sum, student) => sum + student.points, 0);
  const classQuestPercent = Math.min(100, Math.round((classQuestProgress / classQuestGoal) * 100));
  const visibleClassRankings = classRankings.slice(0, 5);
  const myClassRank = classRankings.findIndex((cls) => cls.className === userClass && cls.school === userSchool) + 1;
  const currentStudent = studentRankings.find((student) => student.id === userId) ?? studentRankings[0];
  const topStudentPoints = studentRankings[0]?.points ?? 0;
  const pointsToFirstStudent = currentStudent ? Math.max(0, topStudentPoints - currentStudent.points) : 0;

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <div className="mx-auto max-w-screen-xl px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white shadow-[0_12px_28px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.75)]">
              <img src={AVATAR_BASE_ASSET} alt="Avatar" className="h-full w-full object-contain" />
              {equippedAvatarItem !== "none" && AVATAR_ITEMS[equippedAvatarItem] && (
                <img
                  src={AVATAR_ITEMS[equippedAvatarItem].asset}
                  alt={AVATAR_ITEMS[equippedAvatarItem].name}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black tracking-tight text-foreground">Klasse</h1>
                <span className="text-3xl font-black tracking-tight text-primary">
                  {userClass || "5A"}
                </span>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {userClass || "5A"} • {userSchool || "Deine Schule"} • {studentRankings.length || 0} Schüler:innen
              </p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-sky-300/45 bg-[radial-gradient(circle_at_23%_32%,rgba(6,113,255,0.95)_0%,rgba(8,153,255,0.88)_36%,rgba(24,207,229,0.58)_55%,rgba(185,235,255,0.64)_72%,rgba(245,252,255,0.94)_100%)] text-foreground shadow-[0_20px_42px_rgba(14,165,233,0.16),0_10px_24px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.82)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,rgba(0,93,255,0.14)_0%,rgba(22,183,241,0.2)_42%,rgba(125,211,252,0.4)_68%,rgba(240,249,255,0.88)_100%)]" />
            <div className="pointer-events-none absolute right-[-3rem] top-[-4rem] h-64 w-64 rounded-full bg-sky-300/28 blur-3xl" />
            <div className="grid grid-cols-[minmax(0,1fr)_140px]">
              <div className="relative flex min-h-[14.5rem] items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.4)_0_2px,transparent_3px),radial-gradient(circle_at_18%_28%,rgba(255,255,255,0.5)_0_1px,transparent_2px),radial-gradient(circle_at_65%_42%,rgba(255,255,255,0.28)_0_1px,transparent_2px)]" />
                <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-r from-transparent via-white/12 to-white/62" />
                <div className="absolute bottom-4 left-1/2 h-8 w-40 -translate-x-1/2 rounded-full border-4 border-cyan-200/80 shadow-[0_0_24px_rgba(103,232,249,0.85),inset_0_0_18px_rgba(103,232,249,0.45)]" />
                <div className="absolute right-7 top-9 text-3xl text-yellow-200 drop-shadow-[0_0_12px_rgba(254,240,138,0.9)]">✦</div>
                <img
                  src={boostMascotBlue}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none relative z-10 h-[13.25rem] w-auto object-contain object-center drop-shadow-[0_18px_28px_rgba(3,30,92,0.35)]"
                />
              </div>

              <div className="relative flex flex-col items-center justify-center px-2 py-4">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_42%_42%,rgba(224,242,254,0.82)_0%,rgba(186,230,253,0.46)_50%,transparent_78%)]" />
                <div
                  className="relative flex h-28 w-28 items-center justify-center rounded-full shadow-[0_14px_30px_rgba(14,165,233,0.22),inset_0_2px_0_rgba(255,255,255,0.7)]"
                  style={{
                    background: `conic-gradient(rgb(14 165 233) 0% ${classQuestPercent}%, rgba(186,230,253,0.5) ${classQuestPercent}% 100%)`,
                  }}
                >
                  <div className="flex h-[78px] w-[78px] flex-col items-center justify-center rounded-full bg-white text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                    <p className="text-[10px] font-bold text-foreground/55">Fortschritt {classQuestPercent}%</p>
                    <p className="mt-0.5 text-[1.8rem] font-black leading-none text-foreground">
                      {classQuestProgress}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-base font-bold text-foreground/80">
                      / {classQuestGoal}
                      <Zap className="h-3.5 w-3.5 fill-warning text-warning" />
                    </p>
                  </div>
                </div>
                <p className="relative mt-3 text-center text-xs font-bold text-foreground/55">Wochenziel läuft!</p>
              </div>
            </div>

            <div className="relative flex items-center gap-2 overflow-x-auto bg-white/66 px-5 py-4 backdrop-blur-[2px]">
              {studentRankings.slice(0, 3).map((student, i) => (
                <div key={student.id} className="flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-2 py-1 shadow-[0_8px_16px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.5)]">
                  <div className={`relative h-9 w-9 overflow-hidden rounded-full border-2 border-white shadow-[0_8px_14px_rgba(0,0,0,0.1)] ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                    <img src={avatarPlaceholder} alt={student.username} className="h-full w-full object-cover" />
                  </div>
                  <span className="text-xs font-black text-foreground">
                    {getInitials(student.username)}
                  </span>
                </div>
              ))}
              {studentRankings.length > 3 && (
                <span className="shrink-0 text-sm font-bold text-foreground/65">
                  und {studentRankings.length - 3} weitere Personen
                </span>
              )}
            </div>
          </div>

          {!loading && studentRankings.length > 0 && (
            <div className="space-y-4">
                <div className="overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-[0_18px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]">
                  <div className="grid" style={{ gridTemplateColumns: "47.5% 52.5%" }}>
                  <div className="flex flex-col justify-center p-4">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/12 text-primary shadow-[0_8px_16px_rgba(31,224,102,0.12),inset_0_1px_0_rgba(255,255,255,0.7)]">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <h2 className="text-[1.55rem] font-black leading-none text-foreground">Meine Klasse</h2>
                    <p className="mt-2 text-sm text-foreground/65">
                      {pointsToFirstStudent > 0
                        ? `Noch ${pointsToFirstStudent} Pt. für den ersten Rang.`
                        : "Deine Klasse führt gerade den ersten Rang an."}
                    </p>
                  </div>
                  <div className="border-l border-black/6 p-4">
                    <div className="space-y-3">
                      {studentRankings.slice(0, 3).map((student, idx) => {
                        const colorIdx = studentRankings.findIndex((s) => s.id === student.id) % AVATAR_COLORS.length;
                        return (
                          <div key={student.id} className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-full border border-white/40 ${AVATAR_COLORS[colorIdx]} flex items-center justify-center text-white text-xs font-black shadow-[0_8px_16px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.25)]`}>
                              {getInitials(student.username)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-foreground/90">{student.username}</p>
                              <p className="flex items-center gap-1 text-xs font-medium text-foreground/60">
                                {student.points}
                                <Zap className="h-3 w-3 fill-primary text-primary" />
                              </p>
                            </div>
                            {idx === 1 && <ChevronRight className="h-4 w-4 text-foreground/60" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6 overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-[0_18px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]">
                <div className="grid min-h-[300px]" style={{ gridTemplateColumns: "47.5% 52.5%" }}>
                  <div className="flex flex-col justify-center p-4">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/12 text-primary shadow-[0_8px_16px_rgba(31,224,102,0.12),inset_0_1px_0_rgba(255,255,255,0.7)]">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <h2 className="text-[1.55rem] font-black leading-none text-foreground">
                      Klassen-
                      <br />
                      ranking
                    </h2>
                    <p className="mt-2 text-sm text-foreground/65">alle Klassen</p>
                    <button
                      type="button"
                      onClick={() => setShowAllRankings(true)}
                      className="mt-4 inline-flex w-fit rounded-full border border-black/8 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-foreground shadow-[0_8px_18px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.72)]"
                    >
                      Alle
                    </button>
                  </div>
                  <div className="border-l border-black/6 p-4">
                    <div className="space-y-3">
                      {visibleClassRankings.map((cls, idx) => {
                        const isMyClass = cls.className === userClass && cls.school === userSchool;
                        return (
                          <div key={`${cls.school}-${cls.className}`} className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/40 text-xs font-black shadow-[0_8px_16px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.25)] ${isMyClass ? "bg-primary text-primary-foreground" : idx === 0 ? "bg-yellow-300 text-zinc-950" : idx === 1 ? "bg-zinc-300 text-zinc-950" : idx === 2 ? "bg-orange-200 text-zinc-950" : "bg-zinc-100 text-zinc-700"
                              }`}>
                              {cls.className.toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-foreground/90">{cls.className.toUpperCase()}</p>
                              <p className="flex items-center gap-1 text-xs font-medium text-foreground/60">
                                {cls.totalFlashes}
                                <Zap className="h-3 w-3 fill-primary text-primary" />
                              </p>
                            </div>
                            {isMyClass && <ChevronRight className="h-4 w-4 text-foreground/60" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showAllRankings} onOpenChange={setShowAllRankings}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-xl rounded-[28px] border border-black/5 bg-background p-0 shadow-[0_24px_64px_rgba(0,0,0,0.18)]">
          <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_18px_36px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)]">
            <DialogHeader className="mb-4 text-left">
              <div className="pr-10">
                <DialogTitle className="text-xl font-black text-foreground">Klassenranking</DialogTitle>
                <p className="text-sm text-muted-foreground">Alle aktiven Klassen im Ranking</p>
              </div>
            </DialogHeader>

            <div className="space-y-2">
              {classRankings.map((cls, i) => {
                const isMyClass = cls.className === userClass && cls.school === userSchool;
                return (
                  <div
                    key={`all-${cls.school}-${cls.className}`}
                    className={`flex items-center justify-between gap-3 rounded-[20px] border px-4 py-3 shadow-[0_12px_24px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.72)] ${isMyClass ? "border-primary bg-primary/10" : "border-black/5 bg-white"
                      }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        Klasse {cls.className}
                        {isMyClass && (
                          <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-black uppercase text-primary-foreground">
                            Deine
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{cls.school}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-black text-foreground">#{i + 1}</p>
                      <p className="flex items-center justify-end gap-1 text-xs font-bold text-primary">
                        {cls.totalFlashes.toLocaleString("de")}
                        <Zap className="h-3 w-3 fill-current" />
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {myClassRank > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-[20px] border border-primary bg-primary/10 px-4 py-3 shadow-[0_14px_28px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.42)]">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Dein aktueller Klassenrang</span>
                </div>
                <span className="text-lg font-black text-primary">#{myClassRank}</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Klasse;
