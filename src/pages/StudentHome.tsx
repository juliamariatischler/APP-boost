import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Footprints, Flame, ChevronRight } from "lucide-react";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { StudentNav } from "@/components/student/StudentNav";
import boostLogo from "@/assets/boost-logo.png";
import {
  flushLocalExerciseResults,
  getStudentStats,
  getClassQuest,
  EXERCISE_LABELS,
  type StudentStats,
  type ClassQuest,
} from "@/services/studentDataService";
import { toast } from "sonner";

const FILTER_TABS = [
  { id: "quest",  label: "Wochen-Quest" },
  { id: "klasse", label: "Klasse"       },
  { id: "tryit",  label: "Try It"       },
];

function formatEndsAt(isoString: string): string {
  const d = new Date(isoString);
  const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  return `${days[d.getDay()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function StudentHome() {
  const navigate = useNavigate();
  const { session } = useCodeAuth();
  const [activeFilter, setActiveFilter] = useState("quest");
  const [stats,  setStats]  = useState<StudentStats | null>(null);
  const [quest,  setQuest]  = useState<ClassQuest  | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || session.user_type !== "student") return;

    const load = async () => {
      try {
        // Flush any completed exercise sessions first
        const pts = await flushLocalExerciseResults(session.device_id);
        if (pts > 0) toast.success(`+${pts} ⚡ Blitze gutgeschrieben!`);
      } catch { /* ignore – best effort */ }

      try {
        const [s, q] = await Promise.all([
          getStudentStats(session.device_id),
          getClassQuest(session.device_id),
        ]);
        setStats(s);
        setQuest(q);
      } catch (err) {
        // non-fatal – show UI without data
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [session]);

  if (!session || session.user_type !== "student") {
    navigate("/login", { replace: true });
    return null;
  }

  // Build "Diese Woche" tasks from real today-stats
  const weekTasks = [
    {
      id: "exercise",
      Icon: Zap,
      bg: "bg-orange-500",
      title: "Übung machen",
      subtitle: stats
        ? stats.today_push_ups + stats.today_squats + stats.today_situps + stats.today_jumping_jacks > 0
          ? `Heute: ${stats.today_push_ups} Liegestütze · ${stats.today_squats} Kniebeugen`
          : "Noch keine Übung heute"
        : "Wird geladen…",
      points: 10,
      done: stats
        ? stats.today_push_ups + stats.today_squats + stats.today_situps + stats.today_jumping_jacks > 0
        : false,
    },
    {
      id: "steps",
      Icon: Footprints,
      bg: "bg-green-500",
      title: "Tagesziel Schritte",
      subtitle: "7.500 Schritte (via Health-Sync)",
      points: 10,
      done: false, // steps not yet tracked in code-auth flow
    },
    {
      id: "streak",
      Icon: Flame,
      bg: "bg-sky-500",
      title: "Streak halten",
      subtitle: stats
        ? `${stats.active_days_week} aktiver ${stats.active_days_week === 1 ? "Tag" : "Tage"} diese Woche`
        : "Wird geladen…",
      points: 5,
      done: stats ? stats.active_days_week > 0 : false,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Logo header */}
      <div className="bg-white px-4 pt-6 pb-3 flex flex-col items-center gap-0.5">
        <img src={boostLogo} alt="Boost" className="h-9 w-auto" />
        <p className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase">
          Together we move.
        </p>
      </div>

      {/* Filter pills */}
      <div className="bg-white px-4 py-2 flex gap-2 border-b border-gray-100">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              activeFilter === tab.id
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* Featured quest card */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div
            className="px-4 py-6 flex items-center"
            style={{
              background:
                "repeating-linear-gradient(-45deg,#bbf7d0,#bbf7d0 8px,#dcfce7 8px,#dcfce7 16px)",
            }}
          >
            <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
              Wochen-Quest
            </span>
            <span className="ml-auto flex items-center gap-1 bg-black/10 text-green-900 text-xs font-bold px-2 py-0.5 rounded-full">
              <Zap className="h-3 w-3" /> EPIC
            </span>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="space-y-2">
                <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-4/5" />
              </div>
            ) : quest ? (
              <>
                <p className="text-[11px] text-gray-400 font-semibold mb-1 uppercase tracking-wide">
                  {session.school_name} · Klasse {session.class_name} · Klassenaufgabe
                </p>
                <p className="font-bold text-gray-900 text-base mb-3 leading-snug">
                  {quest.title}
                </p>

                {/* Progress inline */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${quest.percent}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-green-600">{quest.percent}%</span>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    {quest.current_reps.toLocaleString("de-AT")}&nbsp;/&nbsp;
                    {quest.target_reps.toLocaleString("de-AT")}&nbsp;
                    {EXERCISE_LABELS[quest.exercise_type]}
                    &nbsp;· endet {formatEndsAt(quest.ends_at)}
                  </p>
                  <button
                    onClick={() => navigate("/student-quests")}
                    className="flex items-center gap-0.5 text-xs font-semibold text-green-600"
                  >
                    Details <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[11px] text-gray-400 font-semibold mb-1 uppercase tracking-wide">
                  {session.school_name} · Klasse {session.class_name}
                </p>
                <p className="text-sm text-gray-500">Aktuell kein aktiver Klassen-Quest.</p>
              </>
            )}
          </div>
        </div>

        {/* Diese Woche */}
        <div>
          <h2 className="text-lg font-black text-gray-900 mb-3">Diese Woche</h2>
          <div className="space-y-2">
            {weekTasks.map(({ id, Icon, bg, title, subtitle, points, done }) => (
              <div
                key={id}
                className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm"
              >
                <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
                  <p className="text-xs text-gray-400 truncate">{subtitle}</p>
                </div>
                <div className={`flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
                  done
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
                }`}>
                  {done ? "✓" : `+${points}`}
                  {!done && <Zap className="h-3 w-3 ml-0.5 text-gray-400" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <StudentNav />
    </div>
  );
}
