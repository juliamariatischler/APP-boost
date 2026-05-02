import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, ChevronLeft, Clock } from "lucide-react";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { StudentNav } from "@/components/student/StudentNav";
import {
  getClassQuest,
  getStudentStats,
  EXERCISE_LABELS,
  type ClassQuest,
  type StudentStats,
} from "@/services/studentDataService";

interface Quest {
  id: string;
  type: "EPIC" | "DAILY" | "STREAK";
  title: string;
  description: string;
  points: number;
  bonus?: string;
  endsAt: string;
  progress: number;   // 0-100
  activeDays?: number;
  totalDays?: number;
}

function formatEndsAt(iso: string): string {
  const d = new Date(iso);
  const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  return `${days[d.getDay()]} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function buildQuestsFromData(quest: ClassQuest | null, stats: StudentStats | null): Quest[] {
  const exercisedToday = stats
    ? stats.today_push_ups + stats.today_squats + stats.today_situps + stats.today_jumping_jacks > 0
    : false;

  const list: Quest[] = [];

  if (quest) {
    list.push({
      id:          quest.id,
      type:        "EPIC",
      title:       quest.title,
      description: `Gemeinsam ${quest.target_reps.toLocaleString("de-AT")} ${EXERCISE_LABELS[quest.exercise_type]} schaffen`,
      points:      quest.reward_points,
      bonus:       "+ Avatar-Item",
      endsAt:      formatEndsAt(quest.ends_at),
      progress:    quest.percent,
    });
  }

  list.push(
    {
      id:          "exercise",
      type:        "DAILY",
      title:       "Übung des Tages",
      description: "Mach eine Übung und schreibe Blitze gut",
      points:      10,
      endsAt:      "Heute 23:59",
      progress:    exercisedToday ? 100 : 0,
    },
    {
      id:          "streak",
      type:        "STREAK",
      title:       "Streak halten",
      description: "Heute einloggen und aktiv bleiben",
      points:      5,
      endsAt:      "Heute 23:59",
      progress:    stats ? Math.min(stats.active_days_week * 20, 100) : 0,
    },
  );

  return list;
}

const TYPE_STYLE: Record<Quest["type"], { bg: string; text: string; badge: string }> = {
  EPIC:   { bg: "bg-green-500", text: "text-white",    badge: "⚡ EPIC"   },
  DAILY:  { bg: "bg-gray-100",  text: "text-gray-700", badge: "TÄGLICH"  },
  STREAK: { bg: "bg-sky-500",   text: "text-white",    badge: "🔥 STREAK" },
};

function QuestDetail({ quest, onBack }: { quest: Quest; onBack: () => void }) {
  const style = TYPE_STYLE[quest.type];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Nav */}
      <div className="bg-white px-4 pt-6 pb-4 flex items-start justify-between border-b border-gray-100">
        <button
          onClick={onBack}
          className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        <span className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black ${
          quest.type === "EPIC" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-600"
        }`}>
          <Zap className="h-3 w-3" /> {quest.type === "EPIC" ? "EPIC" : quest.type}
        </span>
      </div>

      <div className="px-4 pt-5 space-y-5">
        <h1 className="text-4xl font-black text-gray-900 leading-tight">{quest.title}</h1>

        {/* Reward row */}
        <div className="flex gap-3">
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex-1 text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">Belohnung</p>
            <div className="flex items-center justify-center gap-1 text-gray-900 font-black text-xl">
              {quest.points}
              <Zap className="h-5 w-5 fill-green-500 text-green-500" />
            </div>
          </div>
          {quest.bonus && (
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex-1 text-center">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">Bonus</p>
              <p className="font-black text-gray-900 text-sm">{quest.bonus}</p>
            </div>
          )}
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">Endet</p>
            <p className="font-bold text-gray-900 text-sm">{quest.endsAt}</p>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide">Dein Fortschritt</p>
            <span className="text-sm font-black text-green-600">{quest.progress}%</span>
          </div>
          {quest.activeDays !== undefined && (
            <p className="text-2xl font-black text-gray-900 mb-2">
              {quest.activeDays} / {quest.totalDays} aktive Tage
            </p>
          )}
          <div className="h-2.5 bg-gray-100 rounded-full mb-3">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${quest.progress}%` }}
            />
          </div>
          {quest.totalDays && quest.activeDays !== undefined && quest.activeDays < quest.totalDays && (
            <p className="text-sm text-gray-500">
              Noch {quest.totalDays - quest.activeDays} Tage bis zur Belohnung&nbsp;
              <Zap className="inline h-3.5 w-3.5 fill-green-500 text-green-500" />
            </p>
          )}
        </div>

        {/* How it counts */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-black text-gray-900">So zählt heute</p>
            <p className="text-xs text-gray-400 font-medium">Übung reicht</p>
          </div>
          <div className="space-y-2">
            <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Tagesziel Schritte</p>
                <p className="text-xs text-gray-400">7.500 Schritte</p>
              </div>
              <div className="flex items-center gap-0.5 bg-green-50 px-2 py-1 rounded-full text-xs font-bold text-green-700">
                +10 <Zap className="h-3 w-3 fill-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-sky-500 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Streak halten</p>
                <p className="text-xs text-gray-400">Heute eingeloggt ✓</p>
              </div>
              <div className="flex items-center gap-0.5 bg-green-50 px-2 py-1 rounded-full text-xs font-bold text-green-700">
                +5 <Zap className="h-3 w-3 fill-green-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Reward summary */}
        <div>
          <p className="text-sm font-black text-gray-900 mb-2">Belohnung</p>
          <div className="flex gap-3">
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex-1">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">Garantiert</p>
              <div className="flex items-center gap-1 font-black text-2xl text-gray-900">
                {quest.points}
                <Zap className="h-6 w-6 fill-green-500 text-green-500" />
              </div>
            </div>
            {quest.bonus && (
              <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex-1 flex flex-col items-center justify-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">Avatar-Item</p>
                <span className="text-3xl">🎩</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <StudentNav />
    </div>
  );
}

export default function StudentQuests() {
  const navigate = useNavigate();
  const { session } = useCodeAuth();
  const [selected, setSelected]   = useState<Quest | null>(null);
  const [classQuest, setClassQuest] = useState<ClassQuest | null>(null);
  const [stats, setStats]           = useState<StudentStats | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!session || session.user_type !== "student") return;
    Promise.all([
      getClassQuest(session.device_id),
      getStudentStats(session.device_id),
    ])
      .then(([q, s]) => { setClassQuest(q); setStats(s); })
      .finally(() => setLoading(false));
  }, [session]);

  if (!session || session.user_type !== "student") {
    navigate("/login", { replace: true });
    return null;
  }

  const quests = buildQuestsFromData(classQuest, stats);

  if (selected) {
    return <QuestDetail quest={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white px-4 pt-6 pb-4 border-b border-gray-100">
        <h1 className="text-3xl font-black text-gray-900">Quests</h1>
        <p className="text-sm text-gray-400 font-medium mt-0.5">Deine aktiven Aufgaben</p>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {loading && (
          <div className="text-center py-10 text-sm text-gray-400">Lade Quests…</div>
        )}
        {!loading && quests.map(q => {
          const style = TYPE_STYLE[q.type];
          return (
            <button
              key={q.id}
              onClick={() => setSelected(q)}
              className="w-full bg-white rounded-2xl overflow-hidden shadow-sm text-left"
            >
              {/* Type header */}
              <div className={`${style.bg} px-4 py-3`}>
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-black tracking-wider ${style.text} opacity-80`}>
                    {style.badge}
                  </span>
                  <div className={`flex items-center gap-1 text-xs ${style.text} opacity-70`}>
                    <Clock className="h-3 w-3" />
                    {q.endsAt}
                  </div>
                </div>
                <p className={`font-black text-lg ${style.text} mt-0.5`}>{q.title}</p>
              </div>

              {/* Body */}
              <div className="px-4 py-3">
                <p className="text-sm text-gray-500 mb-3">{q.description}</p>

                <div className="h-1.5 bg-gray-100 rounded-full mb-1.5">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${q.progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{q.progress}% abgeschlossen</span>
                  <div className="flex items-center gap-0.5 bg-green-50 px-2 py-1 rounded-full text-xs font-bold text-green-700">
                    +{q.points} <Zap className="h-3 w-3 fill-green-500 ml-0.5" />
                    {q.bonus && <span className="ml-1 text-gray-500">{q.bonus}</span>}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <StudentNav />
    </div>
  );
}
