import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronRight, GraduationCap, Trophy, Zap } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import boostMascotBlue from "@/assets/boost-mascot-blue.png";
import { AVATAR_BASE_ASSET, AVATAR_ITEMS, AvatarItemId, loadEquippedAvatarItem } from "@/lib/avatarItems";
import { formatDisplayName } from "@/lib/formatName";

interface StudentRanking {
  id: string;
  username: string;
  points: number;
}

interface ClassRanking {
  className: string;
  school: string;
  totalFlashes: number;
  questBonusPoints: number;
}

interface PresentationClassRankingRow {
  school: string;
  class: string;
  total_flashes: number | null;
  student_count?: number | null;
  quest_bonus_points?: number | null;
}

type ClassQuestProgressRow = {
  class_total: number | null;
  goal: number | null;
};

const numberFormat = new Intl.NumberFormat("de-AT");

const Klasse = () => {
  const navigate = useNavigate();
  const [userClass, setUserClass] = useState("");
  const [userSchool, setUserSchool] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [studentRankings, setStudentRankings] = useState<StudentRanking[]>([]);
  const [classRankings, setClassRankings] = useState<ClassRanking[]>([]);
  const [classQuestTotal, setClassQuestTotal] = useState(0);
  const [classQuestGoal, setClassQuestGoal] = useState(1000);
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
            loadClassQuestProgress(),
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
      .order("points", { ascending: false });
    if (data) setStudentRankings(data);
  };

  const loadClassRankings = async () => {
    const { data, error } = await (supabase.rpc as any)("get_class_rankings_with_quest_bonus", {
      p_month_start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    });

    if (!error && data && data.length > 0) {
      setClassRankings(
        (data as PresentationClassRankingRow[]).map((r) => ({
          className: r.class,
          school: r.school,
          totalFlashes: Number(r.total_flashes || 0),
          questBonusPoints: Number(r.quest_bonus_points || 0),
        }))
      );
    } else {
      setClassRankings([
        { className: "3b", school: "NMS Klusemann", totalFlashes: 2840, questBonusPoints: 0 },
        { className: "4a", school: "NMS Straden", totalFlashes: 2635, questBonusPoints: 0 },
        { className: "3e", school: "Ursulinen", totalFlashes: 2410, questBonusPoints: 0 },
        { className: "2c", school: "MS Puntigam", totalFlashes: 2210, questBonusPoints: 0 },
        { className: "1a", school: "MS Eggenberg", totalFlashes: 1980, questBonusPoints: 0 },
        { className: "4c", school: "BRG Petersgasse", totalFlashes: 1760, questBonusPoints: 0 },
      ]);
    }
  };

  const loadClassQuestProgress = async () => {
    const { data, error } = await (supabase.rpc as any)("get_class_quest_progress", {
      p_month_start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    });

    if (!error && data && data.length > 0) {
      const firstRow = (data as ClassQuestProgressRow[])[0];
      setClassQuestTotal(Number(firstRow.class_total || 0));
      setClassQuestGoal(Number(firstRow.goal || 1000));
    }
  };

  const classQuestProgress = classQuestTotal;
  const classQuestPercent = Math.min(100, Math.round((classQuestProgress / Math.max(classQuestGoal, 1)) * 100));
  const visibleClassRankings = classRankings.slice(0, 5);
  const myClassRank = classRankings.findIndex((cls) => cls.className === userClass && cls.school === userSchool) + 1;
  const studentPointsTotal = studentRankings.reduce((sum, student) => sum + student.points, 0);
  const myClassRanking = classRankings.find((cls) => cls.className === userClass && cls.school === userSchool);
  const classQuestBonusPoints = myClassRanking?.questBonusPoints ?? 0;
  const highlightedClassPoints = studentPointsTotal + classQuestBonusPoints;
  const classTotalPoints = studentPointsTotal;
  const currentMonth = startOfMonth(new Date());
  const questSlots = Array.from({ length: 5 }, (_, index) => {
    const slotStart = addMonths(currentMonth, index);
    const isCurrent = index === 0;
    const progress = isCurrent ? classQuestProgress : 0;
    const goal = classQuestGoal;

    return {
      id: `quest-${index}`,
      label: isCurrent ? "Kniebeugen" : `Slot ${index + 1}`,
      startLabel: format(slotStart, "dd.MM.", { locale: de }),
      endLabel: format(endOfMonth(slotStart), "dd.MM.", { locale: de }),
      progress,
      goal,
      complete: progress >= goal,
    };
  });
  const currentStudent = studentRankings.find((student) => student.id === userId);
  const currentStudentRank = studentRankings.findIndex((student) => student.id === userId) + 1;
  const topStudentPoints = studentRankings[0]?.points ?? 0;
  const pointsToFirstStudent = currentStudent ? Math.max(0, topStudentPoints - currentStudent.points) : 0;
  const rankingStatusText = pointsToFirstStudent > 0
    ? `Zum ersten Platz fehlen dir ${pointsToFirstStudent} Punkte.`
    : "Super, du führst in der Klasse an.";

  const renderStudentAvatar = (student: StudentRanking, className = "h-10 w-10") => {
    const isCurrentUser = student.id === userId;
    const equippedItem = isCurrentUser && equippedAvatarItem !== "none" ? AVATAR_ITEMS[equippedAvatarItem] : null;

    return (
      <div className={`relative shrink-0 overflow-hidden rounded-full border-2 border-white bg-white shadow-[0_8px_16px_rgba(0,0,0,0.1)] ${className}`}>
        <img src={AVATAR_BASE_ASSET} alt={formatDisplayName(student.username)} className="h-full w-full object-contain" />
        {equippedItem && (
          <img
            src={equippedItem.asset}
            alt={equippedItem.name}
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}
      </div>
    );
  };

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

          <div className="relative overflow-hidden rounded-[28px] border border-sky-200/50 bg-[linear-gradient(135deg,#0759d6_0%,#0287ef_52%,#06b7f7_100%)] p-3 text-white shadow-[0_22px_46px_rgba(2,132,199,0.28),0_10px_24px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.46)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16)_0_7%,transparent_7%_24%,rgba(255,255,255,0.08)_24%_25%,transparent_25%_100%)]" />
            <div className="pointer-events-none absolute right-6 top-8 h-28 w-24 bg-[radial-gradient(circle,rgba(255,255,255,0.34)_0_2px,transparent_3px)] [background-size:18px_18px] opacity-70" />
            <div className="relative grid grid-cols-[minmax(0,1.05fr)_minmax(8.75rem,0.95fr)] items-center gap-2 px-1 pt-1">
              <div className="relative flex min-h-[13.25rem] items-end justify-center overflow-hidden">
                <div className="absolute bottom-2 left-1/2 h-8 w-40 -translate-x-1/2 rounded-full border-4 border-cyan-200/80 shadow-[0_0_24px_rgba(103,232,249,0.85),inset_0_0_18px_rgba(103,232,249,0.45)]" />
                <div className="absolute right-4 top-9 text-2xl text-yellow-200 drop-shadow-[0_0_12px_rgba(254,240,138,0.9)]">✦</div>
                <div className="absolute left-3 top-[45%] text-2xl text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.9)]">✦</div>
                <img
                  src={boostMascotBlue}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none relative z-10 h-[12.75rem] w-auto object-contain object-center drop-shadow-[0_18px_28px_rgba(3,30,92,0.35)]"
                />
              </div>

              <div className="relative flex min-w-0 flex-col items-center justify-center py-3">
                <p className="text-center text-[11px] font-black uppercase leading-tight tracking-[0.12em] text-white/88">
                  Fortschritt
                  <br />
                  Klassenchallenge
                </p>
                <div
                  className="relative mt-2 flex h-[7.7rem] w-[7.7rem] items-center justify-center rounded-full shadow-[0_14px_28px_rgba(2,44,120,0.25)]"
                  style={{
                    background: `conic-gradient(rgb(31 224 102) 0% ${classQuestPercent}%, rgb(255 255 255) ${classQuestPercent}% 100%)`,
                  }}
                >
                  <div className="flex h-[5.85rem] w-[5.85rem] flex-col items-center justify-center rounded-full bg-[#0b74e8] px-1 text-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
                    <p className="text-[1.7rem] font-black leading-none tracking-normal">
                      {numberFormat.format(classQuestProgress)}
                    </p>
                    <p className="mt-1 text-[1.15rem] font-black leading-none text-white">
                      / {numberFormat.format(classQuestGoal)}
                    </p>
                  </div>
                </div>
                <div className="relative mt-3 w-full rounded-[18px] border border-white/60 bg-white/12 px-3 py-2 text-center shadow-[0_10px_20px_rgba(3,30,92,0.14),inset_0_1px_0_rgba(255,255,255,0.26)]">
                  <p className="text-[10px] font-black uppercase leading-none tracking-[0.12em] text-white/82">Klassenpunkte</p>
                  <p className="mt-1 text-3xl font-black leading-none text-white">
                    {numberFormat.format(highlightedClassPoints)}
                  </p>
                  {classQuestBonusPoints > 0 && (
                    <p className="mt-1 text-[10px] font-black leading-none text-primary">
                      inkl. +{numberFormat.format(classQuestBonusPoints)} Questbonus
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="relative mt-2">
              <div
                className="grid w-full overflow-hidden rounded-[18px] border border-white/65 bg-white shadow-[0_12px_24px_rgba(2,44,120,0.18),inset_0_1px_0_rgba(255,255,255,0.72)]"
                style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr)) minmax(0, 2.5fr)" }}
              >
                {questSlots.map((slot, index) => (
                  <div
                    key={slot.id}
                    className={`min-h-[5.75rem] min-w-0 border-r border-zinc-200/80 px-2 py-2 ${
                      slot.complete || index === 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-white text-foreground"
                    }`}
                  >
                    <div className="flex h-full flex-col justify-between">
                      <div>
                        <p className={`text-[9px] font-black uppercase leading-tight ${slot.complete || index === 0 ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                          {index === 0 ? "Nächste Quest" : slot.label}
                        </p>
                      </div>
                      <div>
                        <p className={`text-[10px] font-bold leading-tight ${slot.complete || index === 0 ? "text-primary-foreground" : "text-muted-foreground"}`}>
                          {slot.startLabel}
                          <br />
                          - {slot.endLabel}
                        </p>
                        <div className={`mt-1.5 h-1.5 overflow-hidden rounded-full ${slot.complete || index === 0 ? "bg-white/40" : "bg-zinc-200"}`}>
                          <div
                            className={`h-full rounded-full ${slot.complete || index === 0 ? "bg-white" : "bg-zinc-300"}`}
                            style={{ width: `${Math.min(100, Math.round((slot.progress / Math.max(slot.goal, 1)) * 100))}%` }}
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="min-h-[5.75rem] min-w-0 bg-sky-950 px-3 py-3 text-white">
                  <div className="flex h-full flex-col justify-between">
                    <p className="text-[10px] font-black uppercase leading-tight tracking-[0.08em] text-white/82">
                      Meine
                      <br />
                      Klasse
                    </p>
                    <div>
                      <p className="flex items-center gap-1 text-2xl font-black leading-none">
                        <Zap className="h-5 w-5 shrink-0 fill-primary text-primary" />
                        {numberFormat.format(classTotalPoints)}
                      </p>
                      <p className="mt-0.5 text-[11px] font-black uppercase leading-none text-white/88">
                        Blitze
                      </p>
                    </div>
                  </div>
                </div>
              </div>
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
                    <div className="flex flex-wrap items-end gap-2">
                      <h2 className="text-[1.55rem] font-black leading-none text-foreground">Meine Klasse</h2>
                      {currentStudentRank > 0 && (
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-black text-primary">
                          #{currentStudentRank}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-foreground/65">
                      {rankingStatusText}
                    </p>
                  </div>
                  <div className="border-l border-black/6 p-4">
                    <div className="space-y-3">
                      {studentRankings.slice(0, 3).map((student, idx) => {
                        return (
                          <div key={student.id} className="flex items-center gap-3">
                            {renderStudentAvatar(student)}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-foreground/90">{formatDisplayName(student.username)}</p>
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
                    <p className="mt-2 text-sm text-foreground/65">Steirische Unterstufen</p>
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
                              <p className="truncate text-sm font-bold text-foreground/90">{cls.school}</p>
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
                <p className="text-sm text-muted-foreground">Steirische Unterstufen im Ranking</p>
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
