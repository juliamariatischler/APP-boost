import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarDays, Home, Trophy, UserPlus, Users, Zap } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDisplayName } from "@/lib/formatName";
import { toast } from "sonner";
import flashAvatarImg from "@/assets/volt-90-plus.png";
import { AVATAR_BASE_ASSET, AVATAR_ITEMS, AvatarItemId, loadEquippedAvatarItem } from "@/lib/avatarItems";

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
  return className.toLowerCase().startsWith("klasse") ? className.toUpperCase() : `KLASSE ${className.toUpperCase()}`;
};

const ClassQuest = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ClassQuestProgressRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [equippedItem, setEquippedItem] = useState<AvatarItemId>("none");

  const monthStart = useMemo(() => format(startOfMonth(new Date()), "yyyy-MM-dd"), []);
  const monthLabel = useMemo(() => format(startOfMonth(new Date()), "MMMM yyyy", { locale: de }), []);

  useEffect(() => {
    const loadClassQuest = async () => {
      setLoading(true);
      setErrorMessage(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/"); return; }
      setCurrentUserId(session.user.id);
      setEquippedItem(loadEquippedAvatarItem(session.user.id));

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
      <div className="mx-auto max-w-[640px] px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        {loading ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-9 w-36 rounded-full" />
            </div>
            <Skeleton className="h-[420px] w-full rounded-[32px]" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-24 rounded-[24px]" />
              <Skeleton className="h-24 rounded-[24px]" />
              <Skeleton className="h-24 rounded-[24px]" />
            </div>
            <Skeleton className="h-24 w-full rounded-[24px]" />
          </div>
        ) : (
          <>
            {/* Hero card */}
            <section className="relative mb-4 overflow-hidden rounded-[32px] bg-[radial-gradient(ellipse_at_30%_0%,hsl(var(--primary)/0.28)_0%,hsl(var(--primary)/0.12)_60%),linear-gradient(160deg,hsl(var(--primary)/0.22)_0%,hsl(var(--primary)/0.08)_100%)] shadow-[0_20px_50px_rgba(22,198,83,0.18),0_8px_20px_rgba(0,0,0,0.05)]">
              {/* Sparkles near avatar fist */}
              <div className="pointer-events-none absolute right-[38%] top-5 text-xl font-black text-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.6)]">✦</div>
              <div className="pointer-events-none absolute right-[28%] top-3 text-sm font-black text-yellow-200">✦</div>
              <div className="pointer-events-none absolute right-[32%] top-12 text-xs font-black text-yellow-300/80">✦</div>
              {/* Lightning bolt left of avatar */}
              <div className="pointer-events-none absolute right-[46%] top-10 text-base text-primary/70">⚡</div>
              {/* Green confetti rectangles */}
              <div className="pointer-events-none absolute right-[4%] top-10 h-3 w-1.5 rotate-[18deg] rounded-sm bg-primary/65" />
              <div className="pointer-events-none absolute right-[6%] top-[54%] h-3.5 w-1.5 rotate-[-22deg] rounded-sm bg-primary/55" />
              <div className="pointer-events-none absolute right-[2%] top-[35%] h-2.5 w-1.5 rotate-[30deg] rounded-sm bg-primary/50" />
              <div className="pointer-events-none absolute left-3 bottom-20 h-3 w-1.5 rotate-[12deg] rounded-sm bg-primary/55" />
              {/* Yellow confetti rectangles */}
              <div className="pointer-events-none absolute right-[10%] top-5 h-2.5 w-1.5 rotate-[-12deg] rounded-sm bg-yellow-400/80" />
              <div className="pointer-events-none absolute right-[16%] top-[50%] h-2 w-1 rotate-[25deg] rounded-sm bg-yellow-400/70" />
              <div className="pointer-events-none absolute left-5 bottom-28 h-2 w-1 rotate-[-8deg] rounded-sm bg-yellow-400/75" />
              <div className="pointer-events-none absolute right-[24%] top-[68%] h-1.5 w-1 rotate-[15deg] rounded-sm bg-yellow-300/70" />
              {/* Blue dot */}
              <div className="pointer-events-none absolute right-[21%] top-[44%] h-2.5 w-2.5 rounded-full bg-blue-400/75" />
              {/* Small white sparkle dot */}
              <div className="pointer-events-none absolute right-[19%] top-[22%] h-1.5 w-1.5 rounded-full bg-white/80" />

              {/* Avatar – top right */}
              <img
                src={flashAvatarImg}
                alt=""
                aria-hidden="true"
                className="absolute -right-4 top-6 z-0 h-[230px] w-[230px] object-contain object-top drop-shadow-[0_20px_30px_rgba(15,80,20,0.20)] sm:h-[260px] sm:w-[260px]"
              />

              {/* Text content */}
              <div className="relative z-10 max-w-[54%] px-6 pt-6">
                <div className="inline-flex items-center gap-1.5 text-primary">
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-sm font-bold capitalize">{monthLabel}</span>
                </div>
                <h1 className="mt-3 font-black leading-[0.92] tracking-tight text-foreground">
                  <span className="block text-[2.2rem]">{numberFormat.format(goal)}</span>
                  <span className="block text-[1.8rem]">Kniebeugen</span>
                </h1>
                <p className="mt-3 text-sm font-medium leading-relaxed text-foreground/70">
                  Gemeinsam als Klasse sammeln.{" "}
                  Jede eingetragene Kniebeuge zählt automatisch dazu.
                </p>
              </div>

              {/* Progress card inside hero */}
              <div className="relative z-10 m-4 mt-5 rounded-[24px] bg-white p-5 shadow-[0_10px_28px_rgba(0,0,0,0.09),inset_0_1px_0_rgba(255,255,255,0.95)]">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-primary">
                      {getClassLabel(className)}
                    </p>
                    <p className="text-[1.9rem] font-black leading-none tracking-tight text-foreground">
                      {numberFormat.format(classTotal)}
                      <span className="ml-1.5 text-base font-black text-primary">
                        / {numberFormat.format(goal)}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xl font-black leading-none text-primary">{progress}%</p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">geschafft</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-3.5 overflow-hidden rounded-full bg-primary/10">
                  <div
                    className="h-full rounded-full bg-primary/80 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold">
                  <span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Home className="h-3.5 w-3.5 text-primary" />
                    </span>
                    <span className="truncate">{schoolName || "Eure Schule"}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {remaining > 0 ? `${numberFormat.format(remaining)} fehlen` : "Ziel erreicht 🎉"}
                  </span>
                </div>
              </div>
            </section>

            {/* Stats row */}
            <div className="mb-5 grid grid-cols-3 gap-3">
              <div className="rounded-[24px] bg-white p-4 text-center shadow-[0_8px_24px_rgba(0,0,0,0.07),inset_0_1px_0_rgba(255,255,255,0.9)]">
                <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-lg font-black leading-none text-foreground">{rows.length}</p>
                <p className="mt-1 text-xs font-bold text-muted-foreground">Dabei</p>
              </div>
              <div className="rounded-[24px] bg-white p-4 text-center shadow-[0_8px_24px_rgba(0,0,0,0.07),inset_0_1px_0_rgba(255,255,255,0.9)]">
                <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Zap className="h-5 w-5 fill-primary" />
                </div>
                <p className="text-lg font-black leading-none text-foreground">{numberFormat.format(classTotal)}</p>
                <p className="mt-1 text-xs font-bold text-muted-foreground">Gesamt</p>
              </div>
              <div className="rounded-[24px] bg-white p-4 text-center shadow-[0_8px_24px_rgba(0,0,0,0.07),inset_0_1px_0_rgba(255,255,255,0.9)]">
                <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Trophy className="h-5 w-5" />
                </div>
                <p className="text-lg font-black leading-none text-foreground">{numberFormat.format(goal)}</p>
                <p className="mt-1 text-xs font-bold text-muted-foreground">Ziel</p>
              </div>
            </div>

            {/* Wer hilft mit? */}
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-tight text-foreground">Wer hilft mit?</h2>
                <p className="mt-0.5 text-sm font-medium text-muted-foreground">Die Kniebeugen dieses Monats werden addiert.</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserPlus className="h-5 w-5" />
              </div>
            </div>

            {/* Leaderboard */}
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
                    <div
                      key={row.student_id}
                      className="rounded-[24px] bg-white p-4 shadow-[0_8px_22px_rgba(0,0,0,0.07),inset_0_1px_0_rgba(255,255,255,0.9)]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 shrink-0 text-center text-lg font-black text-muted-foreground">
                          #{rank}
                        </div>
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-primary/20 bg-white shadow-[0_6px_16px_rgba(22,198,83,0.20)]">
                          <img src={AVATAR_BASE_ASSET} alt={name} className="h-full w-full object-contain" />
                          {row.student_id === currentUserId && equippedItem !== "none" && AVATAR_ITEMS[equippedItem] && (
                            <img src={AVATAR_ITEMS[equippedItem].asset} alt="" className="absolute inset-0 h-full w-full object-contain" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="truncate font-black text-foreground">{name}</p>
                            <p className="shrink-0 font-black text-primary">{numberFormat.format(contribution)}</p>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-primary/10">
                            <div
                              className="h-full rounded-full bg-primary/80"
                              style={{ width: `${share}%` }}
                              aria-hidden="true"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Button
              type="button"
              onClick={() => { window.location.href = "/squat-counter.html"; }}
              className="mt-6 h-14 w-full rounded-[22px] text-base font-black shadow-[0_16px_30px_rgba(34,197,94,0.22)]"
            >
              Kniebeugen eintragen
            </Button>

            <div className="h-6" />
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ClassQuest;
