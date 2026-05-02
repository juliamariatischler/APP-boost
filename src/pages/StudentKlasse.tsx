import { useNavigate } from "react-router-dom";
import { Zap, ChevronRight } from "lucide-react";
import { useCodeAuth } from "@/contexts/CodeAuthContext";
import { StudentNav } from "@/components/student/StudentNav";

// Placeholder data — replace with Supabase RPC calls (get_class_leaderboard, get_school_ranking)
const SCHOOL_RANKING = [
  { rank: 1, name: "Klasse 7B", points: 4820, note: "+570 vor euch",  isMe: false },
  { rank: 2, name: "Klasse 5A", points: 4250, note: "",               isMe: true  },
  { rank: 3, name: "Klasse 8A", points: 3990, note: "−260 hinter euch", isMe: false },
];

const TOP_STUDENTS = [
  { initials: "MR", name: "Mia R.", points: 215, color: "bg-orange-400", rank: 2 },
  { initials: "LK", name: "Lena K.", points: 240, color: "bg-green-500", rank: 1 },
  { initials: "D",  name: "Du",     points: 180, color: "bg-green-400", rank: 3 },
];

const AVATARS = [
  { initials: "LK", color: "bg-green-500" },
  { initials: "LK", color: "bg-blue-500"  },
  { initials: "DU", color: "bg-orange-400"},
  { initials: "TS", color: "bg-pink-500"  },
];

const QUEST_PROGRESS = 34; // percent
const QUEST_CURRENT  = 3420;
const QUEST_TOTAL    = 10000;

export default function StudentKlasse() {
  const navigate = useNavigate();
  const { session } = useCodeAuth();

  if (!session || session.user_type !== "student") {
    navigate("/login", { replace: true });
    return null;
  }

  // Podium order: 2nd left, 1st center, 3rd right
  const podium = [
    TOP_STUDENTS.find(s => s.rank === 2)!,
    TOP_STUDENTS.find(s => s.rank === 1)!,
    TOP_STUDENTS.find(s => s.rank === 3)!,
  ];

  const podiumBarHeight = (rank: number) =>
    rank === 1 ? "h-20" : rank === 2 ? "h-14" : "h-10";

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
            <span className="text-xs font-bold tracking-wide uppercase opacity-80">
              Noch 4 Tage
            </span>
          </div>

          <h2 className="text-xl font-black leading-tight mb-4">
            10.000 Liegestütze gemeinsam
          </h2>

          {/* Progress numbers */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-black">
              {QUEST_CURRENT.toLocaleString("de-AT")}
            </span>
            <span className="text-sm opacity-80">
              / von {QUEST_TOTAL.toLocaleString("de-AT")} – {QUEST_PROGRESS}&nbsp;%
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-white/30 rounded-full mb-4">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${QUEST_PROGRESS}%` }}
            />
          </div>

          {/* Participant row */}
          <div className="flex items-center gap-0.5">
            {AVATARS.map((av, i) => (
              <div
                key={i}
                className={`h-7 w-7 rounded-full ${av.color} border-2 border-green-500 flex items-center justify-center text-white text-[10px] font-bold ${i > 0 ? "-ml-2" : ""}`}
              >
                {av.initials}
              </div>
            ))}
            <span className="ml-3 text-xs font-semibold opacity-80">+ 24 weitere</span>
          </div>
        </div>

        {/* School ranking */}
        <div>
          <h2 className="text-lg font-black text-gray-900 mb-3">Schul-Ranking</h2>
          <div className="space-y-2">
            {SCHOOL_RANKING.map(cls => (
              <div
                key={cls.rank}
                className={`rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm ${
                  cls.isMe
                    ? "bg-green-50 border border-green-200"
                    : "bg-white"
                }`}
              >
                {/* Rank */}
                <span className={`w-5 text-center font-black text-sm ${
                  cls.rank === 1 ? "text-yellow-500" : "text-gray-400"
                }`}>
                  {cls.rank}
                </span>

                {/* Name + note */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 text-sm">{cls.name}</p>
                    {cls.isMe && (
                      <span className="text-[10px] font-black bg-green-600 text-white px-1.5 py-0.5 rounded">
                        DU
                      </span>
                    )}
                  </div>
                  {cls.note && (
                    <p className="text-xs text-gray-400">{cls.note}</p>
                  )}
                </div>

                {/* Points */}
                <div className="flex items-center gap-0.5 font-bold text-sm text-gray-800">
                  {cls.points.toLocaleString("de-AT")}
                  <Zap className="h-4 w-4 fill-green-500 text-green-500 ml-0.5" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top this week */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-gray-900">Top diese Woche</h2>
            <button className="flex items-center gap-0.5 text-sm font-semibold text-green-600">
              Alle ansehen <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-end justify-center gap-3">
              {podium.map(student => (
                <div key={student.name} className="flex flex-col items-center flex-1">
                  {/* Avatar */}
                  <div className={`h-12 w-12 rounded-full ${student.color} flex items-center justify-center text-white font-black text-sm mb-1`}>
                    {student.initials}
                  </div>
                  <p className="text-xs font-semibold text-gray-700 mb-0.5">{student.name}</p>
                  <div className="flex items-center gap-0.5 text-green-600 text-xs font-bold mb-1.5">
                    {student.points}
                    <Zap className="h-3 w-3 fill-green-500 text-green-500" />
                  </div>

                  {/* Podium bar */}
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
              ))}
            </div>
          </div>
        </div>

      </div>

      <StudentNav />
    </div>
  );
}
