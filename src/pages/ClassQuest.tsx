import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, Award, CalendarDays, Dumbbell, Trophy, Users, Zap } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

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

const avatarColors = [
  "bg-[#22c55e] text-white",
  "bg-[#3b82f6] text-white",
  "bg-[#ff7a1a] text-white",
  "bg-[#fde047] text-foreground",
  "bg-[#a855f7] text-white",
];

const getInitials = (name: string) => {
  const cleanName = name.trim();
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

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/");
        return;
      }

      const { data, error } = await (supabase.rpc as any)("get_class_quest_progress", {
        p_month_start: monthStart,
      });

      if (error) {
        setRows([]);
        setErrorMessage("Die Klassenquest konnte gerade nicht geladen werden.");
        setLoading(false);
        return;
      }

      setRows((data ?? []) as ClassQuestProgressRow[]);
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
              <div className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-primary">
                Klassen-Quest
              </div>
            </div>

            <Card className="overflow-hidden rounded-[30px] border border-black/5 bg-white p-0 shadow-[0_22px_48px_rgba(0,0,0,0.10)]">
              <div className="bg-[linear-gradient(135deg,#22c55e_0%,#14b8a6_52%,#38bdf8_100%)] p-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/18 px-3 py-1 text-xs font-black">
                      <CalendarDays className="h-4 w-4" />
                      {monthLabel}
                    </div>
                    <h1 className="mt-5 text-4xl font-black leading-[0.95] tracking-tight">
                      1.000
                      <br />
                      Kniebeugen
                    </h1>
                    <p className="mt-3 max-w-[18rem] text-sm font-semibold leading-relaxed text-white/82">
                      Gemeinsam als Klasse sammeln. Jede eingetragene Kniebeuge zählt automatisch dazu.
                    </p>
                  </div>

                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[26px] bg-white/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                    <Dumbbell className="h-10 w-10" />
                  </div>
                </div>

                <div className="mt-6 rounded-[24px] bg-white p-4 text-foreground shadow-[0_16px_34px_rgba(0,0,0,0.12)]">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                        {getClassLabel(className)}
                      </p>
                      <p className="mt-1 text-3xl font-black leading-none">
                        {numberFormat.format(classTotal)}
                        <span className="ml-1 text-base text-primary">/ {numberFormat.format(goal)}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-primary">{progress}%</p>
                      <p className="text-xs font-bold text-muted-foreground">geschafft</p>
                    </div>
                  </div>
                  <Progress value={progress} className="h-3 rounded-full bg-black/8" />
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-muted-foreground">
                    <span>{schoolName || "Eure Schule"}</span>
                    <span>{remaining > 0 ? `${numberFormat.format(remaining)} fehlen` : "Ziel erreicht"}</span>
                  </div>
                </div>
              </div>
            </Card>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-[20px] bg-white p-3 text-center shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
                <Users className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-1 text-xl font-black">{rows.length}</p>
                <p className="text-[11px] font-bold text-muted-foreground">Dabei</p>
              </div>
              <div className="rounded-[20px] bg-white p-3 text-center shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
                <Zap className="mx-auto h-5 w-5 fill-primary text-primary" />
                <p className="mt-1 text-xl font-black">{numberFormat.format(classTotal)}</p>
                <p className="text-[11px] font-bold text-muted-foreground">Gesamt</p>
              </div>
              <div className="rounded-[20px] bg-white p-3 text-center shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
                <Trophy className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-1 text-xl font-black">{numberFormat.format(goal)}</p>
                <p className="text-[11px] font-bold text-muted-foreground">Ziel</p>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-foreground">Wer hilft mit?</h2>
                  <p className="text-sm font-medium text-muted-foreground">Die Kniebeugen dieses Monats werden addiert.</p>
                </div>
                <Award className="h-6 w-6 text-primary" />
              </div>

              {errorMessage ? (
                <Card className="rounded-[24px] border border-destructive/15 bg-destructive/5 p-5 text-sm font-semibold text-destructive">
                  {errorMessage}
                </Card>
              ) : rows.length === 0 ? (
                <Card className="rounded-[24px] border border-black/5 bg-white p-5 text-sm font-semibold text-muted-foreground">
                  Noch keine Beiträge in dieser Klassenquest.
                </Card>
              ) : (
                <div className="space-y-3">
                  {rows.map((row, index) => {
                    const name = row.username || "Unbekannt";
                    const contribution = row.contribution ?? 0;
                    const share = Math.max(6, Math.round((contribution / topContribution) * 100));
                    const rank = row.rank_position ?? index + 1;

                    return (
                      <Card
                        key={row.student_id}
                        className="overflow-hidden rounded-[24px] border border-black/5 bg-white p-4 shadow-[0_12px_28px_rgba(0,0,0,0.06)]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 text-center text-lg font-black text-foreground">#{rank}</div>
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-black shadow-[0_8px_18px_rgba(0,0,0,0.12)] ${
                              avatarColors[index % avatarColors.length]
                            }`}
                          >
                            {getInitials(name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate text-base font-black text-foreground">{name}</p>
                              <p className="shrink-0 text-base font-black text-primary">
                                {numberFormat.format(contribution)}
                              </p>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/8">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${share}%` }}
                                aria-hidden="true"
                              />
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={() => {
                window.location.href = "/squat-counter.html";
              }}
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
