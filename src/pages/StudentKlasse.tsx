import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, ChevronRight } from "lucide-react";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { StudentNav } from "@/components/student/StudentNav";
import {
  getClassLeaderboard,
  getSchoolRanking,
  getClassQuest,
  EXERCISE_LABELS,
  type LeaderboardEntry,
  type SchoolRankEntry,
  type ClassQuest,
} from "@/services/studentDataService";

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-green-500", "bg-blue-500", "bg-orange-400",
  "bg-pink-500",  "bg-violet-500", "bg-sky-500",
  "bg-amber-500", "bg-teal-500",
];

function avatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function SkeletonRow() {
  return (
    <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
      <div className="w-5 h-4 bg-gray-100 rounded animate-pulse" />
      <div className="flex-1 h-4 bg-gray-100 rounded animate-pulse" />
      <div className="w-16 h-4 bg-gray-100 rounded animate-pulse" />
    </div>
  );
}

export default function StudentKlasse() {
  const navigate = useNavigate();
  const { session } = useCodeAuth();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [ranking,     setRanking]     = useState<SchoolRankEntry[]>([]);
  const [quest,       setQuest]       = useState<ClassQuest | null>(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!session || session.user_type !== "student") return;

    Promise.all([
      getClassLeaderboard(session.device_id),
      getSchoolRanking(session.device_id),
      getClassQuest(session.device_id),
    ])
      .then(([lb, rk, q]) => {
        setLeaderboard(lb);
        setRanking(rk);
        setQuest(q);
      })
      .finally(() => setLoading(false));
  }, [session]);

  if (!session || session.user_type !== "student") {
    navigate("/login", { replace: true });
    return null;
  }

  // Podium order: 2nd left, 1st center, 3rd right
  const top3    = leaderboard.slice(0, 3);
  const podium  = [
    top3.find(s => s.rank === 2) ?? top3[1],
    top3.find(s => s.rank === 1) ?? top3[0],
    top3.find(s => s.rank === 3) ?? top3[2],
  ].filter(Boolean);

  const podiumBarHeight = (rank: number) =>
    rank === 1 ? "h-20" : rank === 2 ? "h-14" : "h-10";

  const questPct = quest?.percent ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-4 border-b border-gray-100">
        <h1 className="text-3xl font-black text-gray-900 leading-tight">
          Klasse {session.class_name}
        </h1>
        <p className="text-sm text-gray-400 font-medium mt-0.5">{session.school_name}</p>
      </div>

      <div className="px-4 pt-4 space-y-5">

        {/* Class quest card */}
        <div className="bg-green-500 rounded-2xl p-5 text-white">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-black tracking-widest uppercase opacity-80">
              Klassen-Quest
            </span>
            {quest && (
              <span className="text-xs font-bold tracking-wide uppercase opacity-80">
                Noch {quest.days_left} {quest.days_left === 1 ? "Tag" : "Tage"}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              <div className="h-7 bg-white/20 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-white/20 rounded animate-pulse w-1/2" />
              <div className="h-2 bg-white/30 rounded-full" />
            </div>
          ) : quest ? (
            <>
              <h2 className="text-xl font-black leading-tight mb-4">{quest.title}</h2>

              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-black">
                  {quest.current_reps.toLocaleString("de-AT")}
                </span>
                <span className="text-sm opacity-80">
                  / {quest.target_reps.toLocaleString("de-AT")}&nbsp;
                  {EXERCISE_LABELS[quest.exercise_type]} – {questPct}&nbsp;%
                </span>
              </div>

              <div className="h-2 bg-white/30 rounded-full mb-4">
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${questPct}%` }}
                />
              </div>

              {/* Participant initials from leaderboard */}
              <div className="flex items-center gap-0.5">
                {leaderboard.slice(0, 4).map((s, i) => (
                  <div
                    key={s.student_id}
                    className={`h-7 w-7 rounded-full ${avatarColor(i)} border-2 border-green-500 flex items-center justify-center text-white text-[10px] font-bold ${i > 0 ? "-ml-2" : ""}`}
                  >
                    {initials(s.display_name)}
                  </div>
                ))}
                {leaderboard.length > 4 && (
                  <span className="ml-3 text-xs font-semibold opacity-80">
                    + {leaderboard.length - 4} weitere
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-white/70 text-sm">Kein aktiver Quest.</p>
          )}
        </div>

        {/* School ranking */}
        <div>
          <h2 className="text-lg font-black text-gray-900 mb-3">Schul-Ranking</h2>
          <div className="space-y-2">
            {loading
              ? [1, 2, 3].map(i => <SkeletonRow key={i} />)
              : ranking.map(cls => {
                  // Compute point difference vs my class
                  const myClass    = ranking.find(r => r.is_my_class);
                  const myPts      = myClass?.weekly_points ?? 0;
                  const diff       = myClass && !cls.is_my_class
                    ? cls.weekly_points - myPts
                    : null;

                  return (
                    <div
                      key={cls.class_id}
                      className={`rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm ${
                        cls.is_my_class
                          ? "bg-green-50 border border-green-200"
                          : "bg-white"
                      }`}
                    >
                      <span className={`w-5 text-center font-black text-sm ${
                        cls.rank === 1 ? "text-yellow-500" : "text-gray-400"
                      }`}>
                        {cls.rank}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 text-sm">
                            Klasse {cls.class_name}
                          </p>
                          {cls.is_my_class && (
                            <span className="text-[10px] font-black bg-green-600 text-white px-1.5 py-0.5 rounded">
                              DU
                            </span>
                          )}
                        </div>
                        {diff !== null && (
                          <p className="text-xs text-gray-400">
                            {diff > 0
                              ? `+${diff.toLocaleString("de-AT")} vor euch`
                              : `${Math.abs(diff).toLocaleString("de-AT")} hinter euch`}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 font-bold text-sm text-gray-800">
                        {cls.weekly_points.toLocaleString("de-AT")}
                        <Zap className="h-4 w-4 fill-green-500 text-green-500 ml-0.5" />
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Top this week – podium */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-gray-900">Top diese Woche</h2>
            <button
              onClick={() => navigate("/student-quests")}
              className="flex items-center gap-0.5 text-sm font-semibold text-green-600"
            >
              Alle ansehen <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl p-5 shadow-sm h-40 flex items-center justify-center">
              <p className="text-sm text-gray-400">Lade…</p>
            </div>
          ) : podium.length > 0 ? (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-end justify-center gap-3">
                {podium.map((student, idx) => {
                  const colorIdx = leaderboard.findIndex(s => s.student_id === student.student_id);
                  return (
                    <div key={student.student_id} className="flex flex-col items-center flex-1">
                      <div className={`h-12 w-12 rounded-full ${avatarColor(colorIdx)} flex items-center justify-center text-white font-black text-sm mb-1 ${student.is_me ? "ring-2 ring-green-400 ring-offset-1" : ""}`}>
                        {initials(student.display_name)}
                      </div>
                      <p className="text-xs font-semibold text-gray-700 mb-0.5 text-center">
                        {student.is_me ? "Du" : student.display_name}
                      </p>
                      <div className="flex items-center gap-0.5 text-green-600 text-xs font-bold mb-1.5">
                        {student.weekly_points}
                        <Zap className="h-3 w-3 fill-green-500 text-green-500" />
                      </div>

                      <div className={`w-full rounded-t-xl ${podiumBarHeight(student.rank)} flex items-center justify-center ${
                        student.rank === 1
                          ? "bg-green-500"
                          : student.rank === 2
                          ? "bg-gray-200"
                          : "bg-orange-200"
                      }`}>
                        <span className={`font-black text-xl ${
                          student.rank === 1 ? "text-white" : "text-gray-500"
                        }`}>
                          {student.rank}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <p className="text-sm text-gray-400">
                Noch keine Punkte – mach die erste Übung!
              </p>
            </div>
          )}
        </div>

      </div>

      <StudentNav />
    </div>
  );
}
