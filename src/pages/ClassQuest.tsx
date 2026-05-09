import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, CalendarDays, ChevronRight, Home, Trophy, UserPlus, Users, Zap } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDisplayName } from "@/lib/formatName";
import { toast } from "sonner";
import classAvatarImg from "@/assets/quest-class-avatar.png";

type ClassQuestProgressRow = {
  student_id: string;
  username: string | null;
  contribution: number | null;
  class_name: string | null;
  school_name: string | null;
  class_total: number | null;
  goal: number | null;
  rank_position: number | null;
};

const numberFormat = new Intl.NumberFormat("de-AT");
const CLASS_QUEST_REWARD_POINTS = 2000;

const getInitials = (name: string) => {
  const cleanName = formatDisplayName(name);
  if (!cleanName) return "?";
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const getClassLabel = (className?: string | null) => {
  if (!className) return "Deine Klasse";
  return className.toLowerCase().startsWith("klasse") ? className : `Klasse ${className}`;
};

const ClassQuest = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ClassQuestProgressRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const monthStart = useMemo(() => format(startOfMonth(new Date()), "yyyy-MM-dd"), []);
  const monthLabel = useMemo(() => format(startOfMonth(new Date()), "MMMM yyyy", { locale: de }), []);

  useEffect(() => {
    const loadClassQuest = async () => {
      setLoading(true);
      setErrorMessage(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/"); return; }

      const { data, error } = await (supabase.rpc as any)("get_class_quest_progress", {
        p_month_start: monthStart,
      });

      if (error) {
        setRows([]);
        setErrorMessage("Die Klassenquest konnte gerade nicht geladen werden.");
        setLoading(false);
        return;
      }

      const nextRows = (data ?? []) as ClassQuestProgressRow[];
      setRows(nextRows);

      const classTotal = Number(nextRows[0]?.class_total || 0);
      const goal = Number(nextRows[0]?.goal || 1000);
      if (classTotal >= goal) {
        const { data: awardData, error: awardError } = await (supabase.rpc as any)("award_class_quest_bonus_if_complete", {
          p_month_start: monthStart,
        });
        if (!awardError && awardData?.awarded) {
          toast.success(`Klassenquest geschafft! +${numberFormat.format(CLASS_QUEST_REWARD_POINTS)} Blitze fürs Klassenranking.`);
        }
      }

      setLoading(false);
    };

    void loadClassQuest();
  }, [monthStart, navigate]);

  const goal = rows[0]?.goal ?? 1000;
  const classTotal = rows[0]?.class_total ?? 0;
  const className = rows[0]?.class_name;
  const schoolName = rows[0]?.school_name;
  const progress = Math.min(100, Math.round((classTotal / goal) * 100));
  const remaining = Math.max(goal - classTotal, 0);
  const topContribution = Math.max(...rows.map((row) => row.contribution ?? 0), 1);

  return (
    <div className="min-h-screen bg-background pb-nav-safe">
      <div className="mx-auto max-w-screen-xl px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-44 rounded-xl" />
            <Skeleton className="h-64 w-full rounded-[28px]" />
            <Skeleton className="h-24 w-full rounded-[24px]" />
            <Skeleton className="h-24 w-full rounded-[24px]" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => navigate("/quests")}
                className="h-11 w-11 rounded-full bg-white shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
                aria-label="Zurück zu den Quests"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-primary shadow-[0_8px_20px_rgba(31,224,102,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]">
                <Zap className="h-4 w-4 fill-primary" />
                Klassen-Quest
              </div>
            </div>

            {/* Hero card */}
            <section className="relative overflow-hidden rounded-[30px] border border-emerald-100 bg-[linear-gradient(135deg,#edfff1_0%,#f5fff6_44%,#d3f8e9_100%)] p-5 shadow-[0_24px_54px_rgba(22,163,74,0.13),0_10px_24px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.82)]">
              {/* Background glow */}
              <div className="pointer-events-none absolute right-[-3rem] top-0 h-60 w-60 rounded-full bg-emerald-300/30 blur-3xl" />

              {/* Confetti decorations */}
              <div className="pointer-events-none absolute right-[43%] top-6 text-xl font-black text-yellow-400">✦</div>
              <div className="pointer-events-none absolute right-[30%] top-16 text-sm font-black text-yellow-300">✦</div>
              <div className="pointer-events-none absolute right-[36%] top-28 text-base text-primary/70">⚡</div>
              <div className="pointer-events-none absolute right-[22%] top-8 text-xs text-primary/60">⚡</div>
              <div className="pointer-events-none absolute right-[40%] top-36 h-2.5 w-5 rotate-[-18deg] rounded-sm bg-yellow-300/75" />
              <div className="pointer-events-none absolute right-[48%] top-20 h-2 w-4 rotate-[12deg] rounded-sm bg-emerald-400/60" />
              <div className="pointer-events-none absolute right-[26%] top-32 h-2 w-2 rotate-45 rounded-sm bg-yellow-400/70" />

              {/* Avatar – top right, no circle */}
              <img
                src={classAvatarImg}
                alt=""
                aria-hidden="true"
                className="absolute -right-3 -top-2 z-0 h-56 w-56 object-contain object-top drop-shadow-[0_16px_24px_rgba(15,23,42,0.14)]"
              />

              {/* Text content – constrained so it doesn't overlap avatar */}
              <div className="relative z-10 max-w-[55%]">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-sm font-black">{monthLabel}</span>
                </div>
                <h1 className="mt-5 text-[3rem] font-black leading-[0.88] tracking-tight text-primary">
                  {numberFormat.format(goal)}
                  <br />
                  <span className="text-[2.4rem] text-foreground">Kniebeugen</span>
                </h1>
                <p className="mt-4 text-sm font-medium leading-relaxed text-foreground/75">
                  Gemeinsam als Klasse sammeln. Jede eingetragene Kniebeuge zählt automatisch dazu.
                </p>
              </div>

              {/* Progress card */}
              <div className="relative z-10 mt-6 rounded-[22px] bg-white p-4 shadow-[0_14px_32px_rgba(0,0,0,0.09),inset_0_1px_0_rgba(255,255,255,0.92)]">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-primary">
                      <Users className="h-3.5 w-3.5" />
                      <span className="truncate">{getClassLabel(className)}</span>
                    </div>
                    <p className="mt-2.5 text-[2.6rem] font-black leading-none tracking-tight">
                      {numberFormat.format(classTotal)}
                      <span className="ml-2 text-xl font-black text-muted-foreground">/ {numberFormat.format(goal)}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-2xl font-black leading-none text-primary">{progress}%</p>
                    <p className="mt-0.5 text-xs font-bold text-muted-foreground">geschafft</p>
                  </div>
                </div>
                <Progress value={progress} className="h-3.5 rounded-full bg-black/6" />
                <div className="mt-3 flex items-center justify-between gap-3 text-sm font-bold text-foreground/75">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <Home className="h-4 w-4 shrink-0 text-foreground/60" />
                    <span className="truncate">{schoolName || "Eure Schule"}</span>
                  </span>
                  <span className="shrink-0 text-foreground/70">
                    {remaining > 0 ? `${numberFormat.format(remaining)} fehlen` : "Ziel erreicht 🎉"}
                  </span>
                </div>
              </div>
            </section>

            {/* Stats row */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="relative overflow-hidden rounded-[22px] bg-white p-4 text-center shadow-[0_12px_28px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.86)]">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <p className="mt-2.5 text-2xl font-black leading-none">{rows.length}</p>
                <p className="mt-1 text-xs font-bold text-muted-foreground">Dabei</p>
              </div>
              <div className="relative overflow-hidden rounded-[22px] bg-white p-4 text-center shadow-[0_12px_28px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.86)]">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Zap className="h-6 w-6 fill-primary" />
                </div>
                <p className="mt-2.5 text-2xl font-black leading-none">{numberFormat.format(classTotal)}</p>
                <p className="mt-1 text-xs font-bold text-muted-foreground">Gesamt</p>
              </div>
              <div className="relative overflow-hidden rounded-[22px] bg-white p-4 text-center shadow-[0_12px_28px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.86)]">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Trophy className="h-5 w-5" />
                </div>
                <p className="mt-2.5 text-2xl font-black leading-none">{numberFormat.format(goal)}</p>
                <p className="mt-1 text-xs font-bold text-muted-foreground">Ziel</p>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="mt-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-foreground">Wer hilft mit?</h2>
                  <p className="mt-0.5 text-sm font-medium text-muted-foreground">Die Kniebeugen dieses Monats werden addiert.</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserPlus className="h-5 w-5" />
                </div>
              </div>

              {errorMessage ? (
                <Card className="rounded-[22px] border border-destructive/15 bg-destructive/5 p-5 text-sm font-semibold text-destructive">
                  {errorMessage}
                </Card>
              ) : rows.length === 0 ? (
                <Card className="rounded-[22px] border border-black/5 bg-white p-5 text-sm font-semibold text-muted-foreground">
                  Noch keine Beiträge in dieser Klassenquest.
                </Card>
              ) : (
                <div className="space-y-3">
                  {rows.map((row, index) => {
                    const name = formatDisplayName(row.username) || "Unbekannt";
                    const contribution = row.contribution ?? 0;
                    const share = contribution > 0 ? Math.max(6, Math.round((contribution / topContribution) * 100)) : 0;
                    const rank = row.rank_position ?? index + 1;

                    return (
                      <Card
                        key={row.student_id}
                        className="overflow-hidden rounded-[22px] border border-black/5 bg-white p-4 shadow-[0_10px_24px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.78)]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 text-center text-lg font-black text-foreground/70">#{rank}</div>
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground shadow-[0_8px_20px_rgba(31,224,102,0.25)]">
                            {getInitials(name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate text-base font-black text-foreground">{name}</p>
                              <p className="shrink-0 text-base font-black text-primary">{numberFormat.format(contribution)}</p>
                            </div>
                            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/7">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${share}%` }}
                                aria-hidden="true"
                              />
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-primary/60" />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={() => { window.location.href = "/squat-counter.html"; }}
              className="mt-6 h-14 w-full rounded-[22px] text-base font-black shadow-[0_16px_30px_rgba(34,197,94,0.22)]"
            >
              Kniebeugen eintragen
            </Button>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ClassQuest;
